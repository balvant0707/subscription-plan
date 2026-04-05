import { json } from "@remix-run/node";
import prisma from "../db.server";
import { createActivity, getShopContext } from "../lib/subscription.server";
import { parseNumber } from "../lib/subscription.utils";

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const customerName = String(payload.customerName || "").trim();
  const customerEmail = String(payload.customerEmail || "").trim();
  const customerGid = String(payload.customerGid || "").trim();
  const subscriptionProductId = String(payload.subscriptionProductId || "").trim();
  const productTitle = String(payload.productTitle || "").trim();
  const interval = String(payload.interval || "MONTHLY").toUpperCase();
  const billingType = String(payload.billingType || "PAY_AS_YOU_GO").toUpperCase();
  const discountValue = parseNumber(payload.discountValue, 0);
  const basePrice = parseNumber(payload.basePrice, 0);
  const shippingAddressLine1 = String(payload.shippingAddressLine1 || "").trim();
  const shippingAddressLine2 = String(payload.shippingAddressLine2 || "").trim();
  const shippingCity = String(payload.shippingCity || "").trim();
  const shippingProvince = String(payload.shippingProvince || "").trim();
  const shippingCountry = String(payload.shippingCountry || "").trim();
  const shippingZip = String(payload.shippingZip || "").trim();
  const nextOrderDate = new Date(
    String(payload.nextOrderDate || new Date().toISOString()),
  );

  if (!customerName || !productTitle) {
    return json(
      { ok: false, message: "customerName and productTitle are required." },
      { status: 400 },
    );
  }

  const subscription = await prisma.subscription.create({
    data: {
      shopId: shop.id,
      subscriptionProductId: subscriptionProductId || null,
      customerGid: customerGid || null,
      customerName,
      customerEmail: customerEmail || null,
      productTitle,
      interval,
      basePrice,
      discountValue,
      billingType,
      status: "ACTIVE",
      shippingAddressLine1: shippingAddressLine1 || null,
      shippingAddressLine2: shippingAddressLine2 || null,
      shippingCity: shippingCity || null,
      shippingProvince: shippingProvince || null,
      shippingCountry: shippingCountry || null,
      shippingZip: shippingZip || null,
      nextOrderDate,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "SUBSCRIPTION_CREATED",
    message: `Created subscription for ${customerName}.`,
    metadata: {
      subscriptionId: subscription.id,
      productTitle,
      interval,
      billingType,
    },
  });

  return json({ ok: true, subscription });
};
