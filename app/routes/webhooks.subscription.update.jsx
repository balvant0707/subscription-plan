import { authenticate } from "../shopify.server";
import db from "../db.server";

function mapWebhookStatus(rawStatus) {
  const status = String(rawStatus || "").toUpperCase();

  if (status.includes("PAUSE")) {
    return "PAUSED";
  }

  if (status.includes("CANCEL")) {
    return "CANCELED";
  }

  if (status.includes("ACTIVE")) {
    return "ACTIVE";
  }

  return null;
}

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const shopRecord = await db.shop.upsert({
    where: { shopDomain: shop },
    update: {},
    create: { shopDomain: shop },
  });

  const externalSubscriptionId = String(
    payload?.admin_graphql_api_id || payload?.id || "",
  );
  const mappedStatus = mapWebhookStatus(payload?.status);

  if (externalSubscriptionId && mappedStatus) {
    const subscription = await db.subscription.findFirst({
      where: {
        shopId: shopRecord.id,
        id: externalSubscriptionId,
      },
    });

    if (subscription) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: { status: mappedStatus },
      });
    }
  }

  await db.activity.create({
    data: {
      shopId: shopRecord.id,
      type: "SUBSCRIPTION_UPDATED",
      message: "Subscription update webhook received.",
      metadata: JSON.stringify({
        webhook: topic,
        externalSubscriptionId,
        mappedStatus,
      }),
    },
  });

  return new Response();
};

