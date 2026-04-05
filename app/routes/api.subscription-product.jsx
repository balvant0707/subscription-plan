import { json } from "@remix-run/node";
import prisma from "../db.server";
import { createActivity, getShopContext } from "../lib/subscription.server";
import { normalizeFrequencies, parseNumber } from "../lib/subscription.utils";

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const shopifyProductId = String(payload.shopifyProductId || "").trim();
  const productTitle = String(payload.productTitle || "").trim();
  const enabled = Boolean(payload.enabled);
  const discountType = String(payload.discountType || "PERCENTAGE").toUpperCase();
  const discountValue = parseNumber(payload.discountValue, 0);
  const defaultFrequency = String(payload.defaultFrequency || "MONTHLY").toUpperCase();
  const frequencies = normalizeFrequencies(
    Array.isArray(payload.frequencyOptions)
      ? payload.frequencyOptions
      : String(payload.frequencyOptions || "").split(","),
  );

  if (!shopifyProductId || !productTitle) {
    return json(
      { ok: false, message: "shopifyProductId and productTitle are required." },
      { status: 400 },
    );
  }

  if (frequencies.length === 0) {
    return json(
      { ok: false, message: "At least one frequency option is required." },
      { status: 400 },
    );
  }

  const subscriptionProduct = await prisma.subscriptionProduct.upsert({
    where: {
      shopId_shopifyProductId: {
        shopId: shop.id,
        shopifyProductId,
      },
    },
    update: {
      productTitle,
      enabled,
      discountType,
      discountValue,
      frequencyOptions: frequencies.join(","),
      defaultFrequency,
    },
    create: {
      shopId: shop.id,
      shopifyProductId,
      productTitle,
      enabled,
      discountType,
      discountValue,
      frequencyOptions: frequencies.join(","),
      defaultFrequency,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "PRODUCT_CONFIG_UPDATED",
    message: `Updated subscription configuration for ${productTitle}.`,
    metadata: {
      shopifyProductId,
      enabled,
      defaultFrequency,
      frequencies,
    },
  });

  return json({ ok: true, subscriptionProduct });
};

