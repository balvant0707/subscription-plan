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
  DataTable,
  InlineStack,
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

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const subscriptions = await prisma.subscription.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
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

  let status = subscription.status;
  let activityType = "SUBSCRIPTION_UPDATED";
  let activityMessage = `Updated subscription for ${subscription.customerName}.`;

  if (intent === "pause") {
    status = "PAUSED";
    activityType = "SUBSCRIPTION_PAUSED";
    activityMessage = `Paused subscription for ${subscription.customerName}.`;
  } else if (intent === "cancel") {
    status = "CANCELED";
    activityType = "SUBSCRIPTION_CANCELED";
    activityMessage = `Canceled subscription for ${subscription.customerName}.`;
  } else if (intent === "resume") {
    status = "ACTIVE";
    activityType = "SUBSCRIPTION_UPDATED";
    activityMessage = `Resumed subscription for ${subscription.customerName}.`;
  } else {
    return json({ ok: false, message: "Unsupported action." }, { status: 400 });
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status },
  });

  await createActivity({
    shopId: shop.id,
    type: activityType,
    message: activityMessage,
    metadata: { subscriptionId: subscription.id, status },
  });

  return json({ ok: true, message: "Subscription status updated." });
};

export default function CustomerSubscriptionsPage() {
  const { subscriptions } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const activeFormSubscriptionId =
    navigation.formData?.get("subscriptionId")?.toString() || "";

  const rows = subscriptions.map((subscription) => [
    subscription.customerName,
    subscription.productTitle,
    formatDate(subscription.nextOrderDate),
    <Badge key={`status-${subscription.id}`} tone={statusTone(subscription.status)}>
      {subscription.status}
    </Badge>,
    <InlineStack key={`actions-${subscription.id}`} gap="100">
      {subscription.status !== "CANCELED" ? (
        <ActionButton
          subscriptionId={subscription.id}
          intent={subscription.status === "PAUSED" ? "resume" : "pause"}
          label={subscription.status === "PAUSED" ? "Resume" : "Pause"}
          loading={activeFormSubscriptionId === subscription.id}
        />
      ) : null}
      {subscription.status !== "CANCELED" ? (
        <ActionButton
          subscriptionId={subscription.id}
          intent="cancel"
          label="Cancel"
          tone="critical"
          loading={activeFormSubscriptionId === subscription.id}
        />
      ) : null}
    </InlineStack>,
  ]);

  return (
    <Page>
      <TitleBar title="Customer Subscriptions" />
      <BlockStack gap="500">
        {actionData?.message ? (
          <Banner tone={actionData.ok ? "success" : "critical"}>
            {actionData.message}
          </Banner>
        ) : null}

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Subscription List
            </Text>
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={[
                "Customer Name",
                "Product",
                "Next Order",
                "Status",
                "Action Buttons",
              ]}
              rows={
                rows.length > 0
                  ? rows
                  : [
                      [
                        "No subscriptions",
                        "--",
                        "--",
                        <Badge key="empty-status">--</Badge>,
                        "Create subscriptions first",
                      ],
                    ]
              }
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function ActionButton({ subscriptionId, intent, label, tone = "success", loading }) {
  return (
    <Form method="post">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="intent" value={intent} />
      <Button submit tone={tone} size="slim" loading={loading}>
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
