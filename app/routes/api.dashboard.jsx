import { json } from "@remix-run/node";
import prisma from "../db.server";
import { buildMonthlyGrowthSeries } from "../lib/analytics.server";
import { getShopContext } from "../lib/subscription.server";
import { formatDate, getRecurringAmount } from "../lib/subscription.utils";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const [subscriptions, logs] = await Promise.all([
    prisma.subscription.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activity.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const totalSubscribers = subscriptions.filter(
    (subscription) => subscription.status !== "CANCELED",
  ).length;

  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "ACTIVE",
  ).length;

  const monthlyRevenue = subscriptions
    .filter((subscription) => ["ACTIVE", "PAUSED"].includes(subscription.status))
    .reduce((total, subscription) => total + getRecurringAmount(subscription), 0);

  const upcomingDate = new Date();
  upcomingDate.setDate(upcomingDate.getDate() + 14);

  const upcomingOrders = subscriptions.filter((subscription) => {
    const nextOrderDate = new Date(subscription.nextOrderDate);
    return subscription.status === "ACTIVE" && nextOrderDate <= upcomingDate;
  }).length;

  const growthSeries = buildMonthlyGrowthSeries(subscriptions, 6);

  return json({
    totalSubscribers,
    monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
    activeSubscriptions,
    upcomingOrders,
    growthSeries,
    recentLogs: logs.map((log) => ({
      id: log.id,
      type: log.type,
      message: log.message,
      date: formatDate(log.createdAt),
    })),
  });
};

