import { json } from "@remix-run/node";
import prisma from "../db.server";
import { PRICING_PLANS } from "../lib/subscription.constants";
import { createActivity, getShopContext } from "../lib/subscription.server";

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const plan = String(payload.plan || "STARTER").toUpperCase();
  const planDetails = PRICING_PLANS.find((item) => item.value === plan);

  if (!planDetails) {
    return json({ ok: false, message: "Unknown plan." }, { status: 400 });
  }

  const pricingPlan = await prisma.shopPricingPlan.upsert({
    where: { shopId: shop.id },
    update: {
      plan: planDetails.value,
      priceMonthly: planDetails.price,
    },
    create: {
      shopId: shop.id,
      plan: planDetails.value,
      priceMonthly: planDetails.price,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "PLAN_CHANGED",
    message: `Switched to ${planDetails.name}.`,
    metadata: { plan: planDetails.value, price: planDetails.price },
  });

  return json({ ok: true, pricingPlan });
};

