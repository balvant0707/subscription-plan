import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { PRICING_PLANS } from "../lib/subscription.constants";
import { createActivity, getShopContext } from "../lib/subscription.server";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const currentPlan = await prisma.shopPricingPlan.findUnique({
    where: { shopId: shop.id },
  });

  return json({ currentPlan: currentPlan?.plan || "STARTER" });
};

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const formData = await request.formData();
  const selectedPlan = String(formData.get("plan") || "STARTER").toUpperCase();

  const planDetails = PRICING_PLANS.find((plan) => plan.value === selectedPlan);
  if (!planDetails) {
    return json({ ok: false, message: "Invalid plan selected." }, { status: 400 });
  }

  await prisma.shopPricingPlan.upsert({
    where: { shopId: shop.id },
    update: {
      plan: planDetails.value,
      priceMonthly: planDetails.price,
    },
    create: {
      shopId: shop.id,
      plan: planDetails.value,
      priceMonthly: planDetails.price,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "PLAN_CHANGED",
    message: `Switched to ${planDetails.name}.`,
    metadata: { plan: planDetails.value, price: planDetails.price },
  });

  return json({ ok: true, message: `${planDetails.name} activated.` });
};

export default function PricingPage() {
  const { currentPlan } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const activePlan = navigation.formData?.get("plan")?.toString();

  return (
    <Page>
      <TitleBar title="Pricing Plan" />
      <BlockStack gap="500">
        {actionData?.message ? (
          <Banner tone={actionData.ok ? "success" : "critical"}>
            {actionData.message}
          </Banner>
        ) : null}

        <Layout>
          {PRICING_PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.value;
            const isLoading =
              navigation.state === "submitting" && activePlan === plan.value;

            return (
              <Layout.Section key={plan.value} variant="oneThird">
                <Card>
                  <BlockStack gap="300">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        {plan.name}
                      </Text>
                      <Text as="p" variant="headingXl">
                        ${plan.price}/month
                      </Text>
                      {isCurrentPlan ? <Badge tone="success">Current plan</Badge> : null}
                    </BlockStack>
                    <List>
                      {plan.features.map((feature) => (
                        <List.Item key={feature}>{feature}</List.Item>
                      ))}
                    </List>
                    <Form method="post">
                      <input type="hidden" name="plan" value={plan.value} />
                      <Button
                        submit
                        variant={isCurrentPlan ? "secondary" : "primary"}
                        disabled={isCurrentPlan}
                        loading={isLoading}
                      >
                        Upgrade
                      </Button>
                    </Form>
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>
      </BlockStack>
    </Page>
  );
}

