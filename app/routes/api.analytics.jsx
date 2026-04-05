import { json } from "@remix-run/node";
import prisma from "../db.server";
import { buildRangeAnalytics } from "../lib/analytics.server";
import { getShopContext } from "../lib/subscription.server";
import { getRecurringAmount } from "../lib/subscription.utils";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const url = new URL(request.url);

  const range = Number(url.searchParams.get("range") || "30");
  const rangeDays = [30, 90, 180].includes(range) ? range : 30;

  const subscriptions = await prisma.subscription.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "asc" },
  });

  const recurringRevenue = subscriptions
    .filter((subscription) => ["ACTIVE", "PAUSED"].includes(subscription.status))
    .reduce((total, subscription) => total + getRecurringAmount(subscription), 0);

  const { revenueSeries, subscriberSeries, churnRate } = buildRangeAnalytics(
    subscriptions,
    rangeDays,
  );

  return json({
    rangeDays,
    churnRate,
    recurringRevenue: Number(recurringRevenue.toFixed(2)),
    revenueSeries,
    subscriberSeries,
  });
};

