import { json } from "@remix-run/node";
import prisma from "../db.server";
import { createActivity } from "../lib/subscription.server";
import { normalizeFrequencies, parseNumber } from "../lib/subscription.utils";
import { authenticate } from "../shopify.server";

const ALLOWED_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"];

export const loader = async ({ request }) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);
  const shop = await getShopFromTokenDest(sessionToken.dest);

  if (!shop) {
    return cors(json({ offers: [] }));
  }

  const products = await prisma.subscriptionProduct.findMany({
    where: { shopId: shop.id, enabled: true },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  const offers = products.map((product) => {
    const frequencies = normalizeFrequencies(product.frequencyOptions.split(","));
    const discountText =
      product.discountType === "FIXED"
        ? `$${Number(product.discountValue).toFixed(2)}`
        : `${product.discountValue}%`;

    return {
      id: product.id,
      shopifyProductId: product.shopifyProductId,
      productTitle: product.productTitle,
      discountType: product.discountType,
      discountValue: product.discountValue,
      discountText,
      defaultFrequency: product.defaultFrequency,
      frequencyOptions: frequencies,
      offerTypes: ["upgrade", "bundle", "discount"],
    };
  });

  return cors(json({ offers }));
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return buildPreflightResponse(request);
  }

  const { sessionToken, cors } = await authenticate.public.checkout(request);
  const shop = await getShopFromTokenDest(sessionToken.dest);

  if (!shop) {
    return cors(json({ ok: false, message: "Shop context not found." }, { status: 404 }));
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return cors(json({ ok: false, message: "Invalid payload." }, { status: 400 }));
  }

  const intent = String(payload.intent || "").trim().toLowerCase();
  if (intent === "dismiss") {
    return cors(json({ ok: true, dismissed: true }));
  }

  if (intent !== "accept_upsell") {
    return cors(json({ ok: false, message: "Unsupported action." }, { status: 400 }));
  }

  const subscriptionProductId = String(payload.subscriptionProductId || "").trim();
  const offerType = String(payload.offerType || "upgrade").trim().toLowerCase();
  const requestedFrequency = String(payload.frequency || "").trim().toUpperCase();
  const selectedFrequency = ALLOWED_FREQUENCIES.includes(requestedFrequency)
    ? requestedFrequency
    : "MONTHLY";

  const product = await prisma.subscriptionProduct.findFirst({
    where: {
      id: subscriptionProductId,
      shopId: shop.id,
      enabled: true,
    },
  });

  if (!product) {
    return cors(json({ ok: false, message: "Offer product not found." }, { status: 404 }));
  }

  const customerGid = String(payload.customerId || sessionToken.sub || "").trim() || null;
  const customerName = String(payload.customerName || "Checkout Customer").trim();
  const customerEmail = String(payload.customerEmail || "")
    .trim()
    .toLowerCase();
  const basePrice = parseNumber(payload.basePrice, 0);
  const nextOrderDate = new Date();
  nextOrderDate.setDate(nextOrderDate.getDate() + getIntervalDays(selectedFrequency));

  const subscription = await prisma.subscription.create({
    data: {
      shopId: shop.id,
      subscriptionProductId: product.id,
      customerGid,
      customerName: customerName || "Checkout Customer",
      customerEmail: customerEmail || null,
      productTitle: product.productTitle,
      interval: selectedFrequency,
      basePrice,
      discountValue: product.discountValue,
      billingType: "PAY_AS_YOU_GO",
      status: "ACTIVE",
      nextOrderDate,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "SUBSCRIPTION_CREATED",
    message: `Checkout upsell accepted for ${product.productTitle}.`,
    metadata: {
      subscriptionId: subscription.id,
      subscriptionProductId: product.id,
      offerType,
      frequency: selectedFrequency,
    },
  });

  return cors(
    json({
      ok: true,
      subscriptionId: subscription.id,
      offerType,
      frequency: selectedFrequency,
    }),
  );
};

function getIntervalDays(interval) {
  if (interval === "WEEKLY") {
    return 7;
  }

  if (interval === "BIWEEKLY") {
    return 14;
  }

  if (interval === "QUARTERLY") {
    return 90;
  }

  return 30;
}

async function getShopFromTokenDest(dest) {
  const shopDomain = getShopDomainFromDest(dest);
  if (!shopDomain) {
    return null;
  }

  return prisma.shop.findUnique({
    where: { shopDomain },
  });
}

function getShopDomainFromDest(dest) {
  const value = String(dest || "").trim();
  if (!value) {
    return "";
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch (error) {
    return value.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  }
}

function buildPreflightResponse(request) {
  const origin = request.headers.get("Origin") || "*";

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}
