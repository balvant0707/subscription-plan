import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Card,
  DataTable,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { ClientOnlySimpleBarChart } from "../components/ClientOnlyPolarisViz";
import { buildMonthlyGrowthSeries } from "../lib/analytics.server";
import {
  getShopContext,
} from "../lib/subscription.server";
import { formatDate, getRecurringAmount } from "../lib/subscription.utils";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const [subscriptions, activities] = await Promise.all([
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

  const monthlyRecurringRevenue = subscriptions
    .filter((subscription) =>
      ["ACTIVE", "PAUSED"].includes(subscription.status),
    )
    .reduce((total, subscription) => total + getRecurringAmount(subscription), 0);

  const upcomingDate = new Date();
  upcomingDate.setDate(upcomingDate.getDate() + 14);

  const upcomingOrders = subscriptions.filter((subscription) => {
    const nextOrderDate = new Date(subscription.nextOrderDate);
    return subscription.status === "ACTIVE" && nextOrderDate <= upcomingDate;
  }).length;

  const growthSeries = buildMonthlyGrowthSeries(subscriptions, 6);
  const activityRows = activities.map((activity) => [
    activity.type.replaceAll("_", " "),
    activity.message,
    formatDate(activity.createdAt),
  ]);

  return json({
    totalSubscribers,
    activeSubscriptions,
    monthlyRecurringRevenue: Number(monthlyRecurringRevenue.toFixed(2)),
    upcomingOrders,
    growthSeries,
    activityRows,
  });
};

export default function DashboardPage() {
  const {
    totalSubscribers,
    activeSubscriptions,
    monthlyRecurringRevenue,
    upcomingOrders,
    growthSeries,
    activityRows,
  } = useLoaderData();
  const growthChartData = [
    {
      name: "Subscribers",
      data: growthSeries.map((point) => ({
        key: point.label,
        value: point.value,
      })),
    },
  ];

  return (
    <Page>
      <TitleBar title="Dashboard" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
              }}
            >
              <MetricCard
                title="Total Subscribers"
                value={totalSubscribers.toLocaleString()}
              />
              <MetricCard
                title="Monthly Recurring Revenue"
                value={`$${monthlyRecurringRevenue.toLocaleString()}`}
              />
              <MetricCard
                title="Active Subscriptions"
                value={activeSubscriptions.toLocaleString()}
              />
              <MetricCard
                title="Upcoming Orders"
                value={upcomingOrders.toLocaleString()}
              />
            </div>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Growth Chart
                </Text>
                <ClientOnlySimpleBarChart
                  data={growthChartData}
                  yAxisOptions={{ integersOnly: true }}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Recent Activity
                </Text>
                <DataTable
                  columnContentTypes={["text", "text", "text"]}
                  headings={["Activity", "Details", "Date"]}
                  rows={
                    activityRows.length > 0
                      ? activityRows
                      : [["No activity yet", "Create a subscription to begin", "--"]]
                  }
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function MetricCard({ title, value }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
        <Text as="p" variant="heading2xl">
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}
