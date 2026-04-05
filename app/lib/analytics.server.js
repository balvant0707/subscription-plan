import { getRecurringAmount } from "./subscription.utils";

export function buildMonthlyGrowthSeries(subscriptions, monthCount = 6) {
  const labels = [];
  const now = new Date();

  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    labels.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      value: 0,
    });
  }

  const lookup = new Map(labels.map((item) => [item.key, item]));

  subscriptions.forEach((subscription) => {
    const createdAt = new Date(subscription.createdAt);
    const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
    const bucket = lookup.get(key);
    if (bucket) {
      bucket.value += 1;
    }
  });

  return labels;
}

export function buildRangeAnalytics(subscriptions, rangeDays) {
  const now = new Date();
  const start = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const bucketCount = rangeDays <= 30 ? 6 : rangeDays <= 90 ? 9 : 12;
  const bucketMs = (rangeDays * 24 * 60 * 60 * 1000) / bucketCount;

  const revenueSeries = Array.from({ length: bucketCount }, (_, index) => {
    const bucketDate = new Date(start.getTime() + bucketMs * index);
    return {
      label: bucketDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: 0,
    };
  });

  const subscriberSeries = revenueSeries.map((item) => ({ ...item, value: 0 }));

  const inRangeSubscriptions = subscriptions.filter(
    (subscription) => new Date(subscription.createdAt) >= start,
  );

  inRangeSubscriptions.forEach((subscription) => {
    const createdAt = new Date(subscription.createdAt);
    const bucket = Math.min(
      bucketCount - 1,
      Math.floor((createdAt.getTime() - start.getTime()) / bucketMs),
    );

    revenueSeries[bucket].value += getRecurringAmount(subscription);
    subscriberSeries[bucket].value += 1;
  });

  for (let index = 1; index < subscriberSeries.length; index += 1) {
    subscriberSeries[index].value += subscriberSeries[index - 1].value;
  }

  const totalInRange = inRangeSubscriptions.length;
  const canceledInRange = inRangeSubscriptions.filter(
    (subscription) => subscription.status === "CANCELED",
  ).length;

  const churnRate = totalInRange === 0 ? 0 : (canceledInRange / totalInRange) * 100;

  return {
    revenueSeries: revenueSeries.map((item) => ({
      ...item,
      value: Number(item.value.toFixed(2)),
    })),
    subscriberSeries,
    churnRate: Number(churnRate.toFixed(2)),
  };
}
