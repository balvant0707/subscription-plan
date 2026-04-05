import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import {
  createActivity,
  getShopContext,
} from "../lib/subscription.server";
import { formatDate } from "../lib/subscription.utils";

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

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const subscriptions = await prisma.subscription.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return json({ subscriptions });
};

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const formData = await request.formData();

  const subscriptionId = String(formData.get("subscriptionId") || "");
  const intent = String(formData.get("intent") || "");

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
  let activityType = "PORTAL_UPDATED";
  let activityMessage = `Updated subscription for ${subscription.customerName}.`;

  if (intent === "pause") {
    data = { status: "PAUSED" };
    activityType = "SUBSCRIPTION_PAUSED";
    activityMessage = `Paused subscription for ${subscription.customerName}.`;
  } else if (intent === "cancel") {
    data = { status: "CANCELED" };
    activityType = "SUBSCRIPTION_CANCELED";
    activityMessage = `Canceled subscription for ${subscription.customerName}.`;
  } else if (intent === "resume") {
    data = { status: "ACTIVE" };
    activityType = "SUBSCRIPTION_UPDATED";
    activityMessage = `Resumed subscription for ${subscription.customerName}.`;
  } else if (intent === "skip") {
    const nextOrderDate = new Date(subscription.nextOrderDate);
    nextOrderDate.setDate(nextOrderDate.getDate() + getIntervalDays(subscription.interval));
    data = { nextOrderDate, status: "ACTIVE" };
    activityType = "SUBSCRIPTION_SKIPPED";
    activityMessage = `Skipped next order for ${subscription.customerName}.`;
  } else {
    return json({ ok: false, message: "Unsupported action." }, { status: 400 });
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data,
  });

  await createActivity({
    shopId: shop.id,
    type: activityType,
    message: activityMessage,
    metadata: { subscriptionId: subscription.id, intent },
  });

  return json({ ok: true, message: "Customer portal action completed." });
};

export default function CustomerPortalPage() {
  const { subscriptions } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const activeId = navigation.formData?.get("subscriptionId")?.toString() || "";

  return (
    <Page>
      <TitleBar title="Customer Portal" />
      <BlockStack gap="500">
        {actionData?.message ? (
          <Banner tone={actionData.ok ? "success" : "critical"}>
            {actionData.message}
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Subscription List
                </Text>
                {subscriptions.length === 0 ? (
                  <Text as="p" variant="bodyMd">
                    No subscriptions available yet.
                  </Text>
                ) : (
                  subscriptions.map((subscription) => (
                    <Card key={subscription.id}>
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text as="h3" variant="headingSm">
                            {subscription.customerName}
                          </Text>
                          <Badge tone={statusTone(subscription.status)}>
                            {subscription.status}
                          </Badge>
                        </InlineStack>
                        <Text as="p" variant="bodyMd">
                          {subscription.productTitle}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Next Order Date: {formatDate(subscription.nextOrderDate)}
                        </Text>
                        <InlineStack gap="200">
                          {subscription.status !== "CANCELED" ? (
                            <PortalActionButton
                              subscriptionId={subscription.id}
                              intent={subscription.status === "PAUSED" ? "resume" : "pause"}
                              label={subscription.status === "PAUSED" ? "Resume" : "Pause"}
                              loading={activeId === subscription.id}
                            />
                          ) : null}
                          {subscription.status === "ACTIVE" ? (
                            <PortalActionButton
                              subscriptionId={subscription.id}
                              intent="skip"
                              label="Skip"
                              loading={activeId === subscription.id}
                            />
                          ) : null}
                          {subscription.status !== "CANCELED" ? (
                            <PortalActionButton
                              subscriptionId={subscription.id}
                              intent="cancel"
                              label="Cancel"
                              tone="critical"
                              loading={activeId === subscription.id}
                            />
                          ) : null}
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  ))
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function PortalActionButton({
  subscriptionId,
  intent,
  label,
  tone = "success",
  loading,
}) {
  return (
    <Form method="post">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="intent" value={intent} />
      <Button submit size="slim" tone={tone} loading={loading}>
        {label}
      </Button>
    </Form>
  );
}

function statusTone(status) {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "PAUSED") {
    return "warning";
  }

  if (status === "CANCELED") {
    return "critical";
  }

  return "info";
}
