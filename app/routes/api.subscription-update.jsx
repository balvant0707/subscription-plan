import { json } from "@remix-run/node";
import prisma from "../db.server";
import { createActivity, getShopContext } from "../lib/subscription.server";

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

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const subscriptionId = String(payload.subscriptionId || "");
  const intent = String(payload.intent || "").toLowerCase();

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription || subscription.shopId !== shop.id) {
    return json(
      { ok: false, message: "Subscription not found for this shop." },
      { status: 404 },
    );
  }

  let data = {};
  let activityType = "SUBSCRIPTION_UPDATED";
  let message = `Updated subscription for ${subscription.customerName}.`;

  if (intent === "pause") {
    data = { status: "PAUSED" };
    activityType = "SUBSCRIPTION_PAUSED";
    message = `Paused subscription for ${subscription.customerName}.`;
  } else if (intent === "cancel") {
    data = { status: "CANCELED" };
    activityType = "SUBSCRIPTION_CANCELED";
    message = `Canceled subscription for ${subscription.customerName}.`;
  } else if (intent === "resume") {
    data = { status: "ACTIVE" };
    activityType = "SUBSCRIPTION_UPDATED";
    message = `Resumed subscription for ${subscription.customerName}.`;
  } else if (intent === "skip") {
    const nextOrderDate = new Date(subscription.nextOrderDate);
    nextOrderDate.setDate(nextOrderDate.getDate() + getIntervalDays(subscription.interval));
    data = { nextOrderDate, status: "ACTIVE" };
    activityType = "SUBSCRIPTION_SKIPPED";
    message = `Skipped next order for ${subscription.customerName}.`;
  } else {
    return json({ ok: false, message: "Unsupported intent." }, { status: 400 });
  }

  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscription.id },
    data,
  });

  await createActivity({
    shopId: shop.id,
    type: activityType,
    message,
    metadata: { subscriptionId: subscription.id, intent },
  });

  return json({ ok: true, subscription: updatedSubscription });
};

