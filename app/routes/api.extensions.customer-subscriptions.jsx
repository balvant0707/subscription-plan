import { json } from "@remix-run/node";
import prisma from "../db.server";
import { createActivity } from "../lib/subscription.server";
import { authenticate } from "../shopify.server";

const ALLOWED_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"];

export const loader = async ({ request }) => {
  const { sessionToken, cors } = await authenticate.public.customerAccount(request);
  const shop = await getShopFromTokenDest(sessionToken.dest);

  if (!shop) {
    return cors(json({ subscriptions: [] }));
  }

  const url = new URL(request.url);
  const customerGid = String(
    url.searchParams.get("customerId") || sessionToken.sub || "",
  ).trim();
  const customerEmail = String(url.searchParams.get("customerEmail") || "")
    .trim()
    .toLowerCase();

  const customerWhere = buildCustomerWhere(shop.id, customerGid, customerEmail);
  if (!customerWhere) {
    return cors(json({ subscriptions: [] }));
  }

  const subscriptions = await prisma.subscription.findMany({
    where: customerWhere,
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return cors(
    json({
      subscriptions: subscriptions.map(mapSubscription),
    }),
  );
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return buildPreflightResponse(request);
  }

  const { sessionToken, cors } = await authenticate.public.customerAccount(request);
  const shop = await getShopFromTokenDest(sessionToken.dest);

  if (!shop) {
    return cors(json({ ok: false, message: "Shop context not found." }, { status: 404 }));
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return cors(json({ ok: false, message: "Invalid payload." }, { status: 400 }));
  }

  const subscriptionId = String(payload.subscriptionId || "").trim();
  const intent = String(payload.intent || "").trim().toLowerCase();
  const customerGid = String(payload.customerId || sessionToken.sub || "").trim();
  const customerEmail = String(payload.customerEmail || "")
    .trim()
    .toLowerCase();

  const customerAccess = buildCustomerAccess(customerGid, customerEmail);
  if (!customerAccess) {
    return cors(
      json(
        {
          ok: false,
          message: "Customer identity is required to manage subscriptions.",
        },
        { status: 403 },
      ),
    );
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      shopId: shop.id,
      OR: customerAccess,
    },
  });

  if (!subscription) {
    return cors(json({ ok: false, message: "Subscription not found." }, { status: 404 }));
  }

  const update = buildSubscriptionUpdate(intent, payload, subscription);
  if (!update) {
    return cors(json({ ok: false, message: "Unsupported action." }, { status: 400 }));
  }

  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscription.id },
    data: update.data,
  });

  await createActivity({
    shopId: shop.id,
    type: update.activityType,
    message: update.message,
    metadata: {
      subscriptionId: subscription.id,
      intent,
      customerGid: customerGid || null,
      customerEmail: customerEmail || null,
    },
  });

  return cors(
    json({
      ok: true,
      subscription: mapSubscription(updatedSubscription),
    }),
  );
};

function buildSubscriptionUpdate(intent, payload, subscription) {
  if (intent === "pause") {
    return {
      data: { status: "PAUSED" },
      activityType: "SUBSCRIPTION_PAUSED",
      message: `Customer paused subscription for ${subscription.productTitle}.`,
    };
  }

  if (intent === "resume") {
    return {
      data: { status: "ACTIVE" },
      activityType: "SUBSCRIPTION_UPDATED",
      message: `Customer resumed subscription for ${subscription.productTitle}.`,
    };
  }

  if (intent === "cancel") {
    return {
      data: { status: "CANCELED" },
      activityType: "SUBSCRIPTION_CANCELED",
      message: `Customer canceled subscription for ${subscription.productTitle}.`,
    };
  }

  if (intent === "skip") {
    const nextOrderDate = new Date(subscription.nextOrderDate);
    nextOrderDate.setDate(nextOrderDate.getDate() + getIntervalDays(subscription.interval));

    return {
      data: { nextOrderDate, status: "ACTIVE" },
      activityType: "SUBSCRIPTION_SKIPPED",
      message: `Customer skipped the next order for ${subscription.productTitle}.`,
    };
  }

  if (intent === "frequency") {
    const nextFrequency = String(payload.frequency || "").trim().toUpperCase();
    if (!ALLOWED_FREQUENCIES.includes(nextFrequency)) {
      return null;
    }

    return {
      data: { interval: nextFrequency, status: "ACTIVE" },
      activityType: "SUBSCRIPTION_UPDATED",
      message: `Customer changed subscription frequency for ${subscription.productTitle}.`,
    };
  }

  if (intent === "address") {
    const address = payload.address || {};
    const line1 = String(address.line1 || "").trim();
    const line2 = String(address.line2 || "").trim();
    const city = String(address.city || "").trim();
    const province = String(address.province || "").trim();
    const country = String(address.country || "").trim();
    const zip = String(address.zip || "").trim();

    return {
      data: {
        shippingAddressLine1: line1 || null,
        shippingAddressLine2: line2 || null,
        shippingCity: city || null,
        shippingProvince: province || null,
        shippingCountry: country || null,
        shippingZip: zip || null,
      },
      activityType: "SUBSCRIPTION_UPDATED",
      message: `Customer updated shipping address for ${subscription.productTitle}.`,
    };
  }

  return null;
}

function buildCustomerWhere(shopId, customerGid, customerEmail) {
  const access = buildCustomerAccess(customerGid, customerEmail);
  if (!access) {
    return null;
  }

  return {
    shopId,
    OR: access,
  };
}

function buildCustomerAccess(customerGid, customerEmail) {
  const access = [];

  if (customerGid) {
    access.push({ customerGid });
  }

  if (customerEmail) {
    access.push({ customerEmail });
  }

  return access.length > 0 ? access : null;
}

function mapSubscription(subscription) {
  return {
    id: subscription.id,
    productTitle: subscription.productTitle,
    status: subscription.status,
    interval: subscription.interval,
    nextOrderDate: subscription.nextOrderDate,
    shippingAddressLine1: subscription.shippingAddressLine1,
    shippingAddressLine2: subscription.shippingAddressLine2,
    shippingCity: subscription.shippingCity,
    shippingProvince: subscription.shippingProvince,
    shippingCountry: subscription.shippingCountry,
    shippingZip: subscription.shippingZip,
  };
}

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
