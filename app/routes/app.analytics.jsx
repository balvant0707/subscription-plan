import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useEffect, useState } from "react";
import {
  BlockStack,
  Card,
  Layout,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import {
  ClientOnlyLineChart,
  ClientOnlySimpleBarChart,
} from "../components/ClientOnlyPolarisViz";
import { buildRangeAnalytics } from "../lib/analytics.server";
import { DATE_RANGE_OPTIONS } from "../lib/subscription.constants";
import { getShopContext } from "../lib/subscription.server";
import { getRecurringAmount } from "../lib/subscription.utils";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const url = new URL(request.url);

  const selectedRange = String(url.searchParams.get("range") || "30");
  const rangeDays = [30, 90, 180].includes(Number(selectedRange))
    ? Number(selectedRange)
    : 30;

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
    selectedRange: String(rangeDays),
    churnRate,
    recurringRevenue: Number(recurringRevenue.toFixed(2)),
    revenueSeries,
    subscriberSeries,
  });
};

export default function AnalyticsPage() {
  const {
    selectedRange,
    churnRate,
    recurringRevenue,
    revenueSeries,
    subscriberSeries,
  } = useLoaderData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [range, setRange] = useState(selectedRange);

  useEffect(() => {
    setRange(selectedRange);
  }, [selectedRange]);

  const revenueChartData = [
    {
      name: "Revenue",
      data: revenueSeries.map((point) => ({
        key: point.label,
        value: Number(point.value),
      })),
    },
  ];

  const subscriberChartData = [
    {
      name: "Subscribers",
      data: subscriberSeries.map((point) => ({
        key: point.label,
        value: Number(point.value),
      })),
    },
  ];

  return (
    <Page>
      <TitleBar title="Analytics" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Date Range
                </Text>
                <Select
                  label="Date Range"
                  labelHidden
                  options={DATE_RANGE_OPTIONS}
                  value={range}
                  onChange={(value) => {
                    setRange(value);
                    submit({ range: value }, { method: "get", replace: true });
                  }}
                  disabled={navigation.state === "loading"}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Revenue Graph
                  </Text>
                  <Text as="p" variant="headingXl">
                    ${recurringRevenue.toLocaleString()}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Churn Rate
                  </Text>
                  <Text as="p" variant="headingXl">
                    {churnRate}%
                  </Text>
                </BlockStack>
              </Card>
            </div>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Revenue Chart
                </Text>
                <ClientOnlyLineChart
                  data={revenueChartData}
                  yAxisOptions={{
                    labelFormatter: (value) => `$${Number(value).toLocaleString()}`,
                  }}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Subscriber Growth
                </Text>
                <ClientOnlySimpleBarChart
                  data={subscriberChartData}
                  yAxisOptions={{ integersOnly: true }}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
