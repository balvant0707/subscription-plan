import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const shopRecord = await db.shop.upsert({
    where: { shopDomain: shop },
    update: {},
    create: { shopDomain: shop },
  });

  const orderId = String(payload?.id ?? "");
  const orderAmount = Number.parseFloat(String(payload?.current_total_price ?? "0"));
  const orderDate = payload?.created_at ? new Date(payload.created_at) : new Date();
  const firstLineItemTitle = String(payload?.line_items?.[0]?.title ?? "");

  let matchedSubscriptionId = null;

  if (firstLineItemTitle) {
    const matchedSubscription = await db.subscription.findFirst({
      where: {
        shopId: shopRecord.id,
        status: "ACTIVE",
        productTitle: firstLineItemTitle,
      },
      orderBy: { createdAt: "desc" },
    });

    matchedSubscriptionId = matchedSubscription?.id ?? null;
  }

  if (orderId) {
    await db.subscriptionOrder.upsert({
      where: {
        shopId_shopifyOrderId: {
          shopId: shopRecord.id,
          shopifyOrderId: orderId,
        },
      },
      update: {
        subscriptionId: matchedSubscriptionId,
        orderAmount: Number.isFinite(orderAmount) ? orderAmount : 0,
        orderDate,
        status: "CREATED",
      },
      create: {
        shopId: shopRecord.id,
        subscriptionId: matchedSubscriptionId,
        shopifyOrderId: orderId,
        orderAmount: Number.isFinite(orderAmount) ? orderAmount : 0,
        orderDate,
        status: "CREATED",
      },
    });
  }

  await db.activity.create({
    data: {
      shopId: shopRecord.id,
      type: "SUBSCRIPTION_UPDATED",
      message: `Order created webhook received (${orderId || "unknown order"}).`,
      metadata: JSON.stringify({
        webhook: topic,
        orderId,
        lineItem: firstLineItemTitle,
        matchedSubscriptionId,
      }),
    },
  });

  return new Response();
};

