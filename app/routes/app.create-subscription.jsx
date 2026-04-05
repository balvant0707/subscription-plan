import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useMemo, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import {
  BILLING_TYPE_OPTIONS,
  FREQUENCY_OPTIONS,
} from "../lib/subscription.constants";
import {
  createActivity,
  getShopContext,
} from "../lib/subscription.server";
import { parseNumber } from "../lib/subscription.utils";

function getDefaultNextOrderDate() {
  const nextOrderDate = new Date();
  nextOrderDate.setDate(nextOrderDate.getDate() + 30);
  return nextOrderDate.toISOString().split("T")[0];
}

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const products = await prisma.subscriptionProduct.findMany({
    where: { shopId: shop.id, enabled: true },
    orderBy: { updatedAt: "desc" },
  });

  return json({
    products: products.map((product) => ({
      id: product.id,
      shopifyProductId: product.shopifyProductId,
      productTitle: product.productTitle,
      defaultFrequency: product.defaultFrequency,
      discountValue: product.discountValue,
    })),
  });
};

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const formData = await request.formData();

  const customerName = String(formData.get("customerName") || "").trim();
  const customerEmail = String(formData.get("customerEmail") || "").trim();
  const subscriptionProductId = String(
    formData.get("subscriptionProductId") || "",
  ).trim();
  const productTitle = String(formData.get("productTitle") || "").trim();
  const interval = String(formData.get("interval") || "MONTHLY").toUpperCase();
  const billingType = String(
    formData.get("billingType") || "PAY_AS_YOU_GO",
  ).toUpperCase();
  const discountValue = parseNumber(formData.get("discountValue"), 0);
  const basePrice = parseNumber(formData.get("basePrice"), 0);
  const nextOrderDateValue = String(
    formData.get("nextOrderDate") || getDefaultNextOrderDate(),
  );
  const nextOrderDate = new Date(nextOrderDateValue);

  if (!customerName || !productTitle) {
    return json(
      { ok: false, message: "Customer name and product are required." },
      { status: 400 },
    );
  }

  await prisma.subscription.create({
    data: {
      shopId: shop.id,
      subscriptionProductId: subscriptionProductId || null,
      customerName,
      customerEmail: customerEmail || null,
      productTitle,
      interval,
      basePrice,
      discountValue,
      billingType,
      status: "ACTIVE",
      nextOrderDate,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "SUBSCRIPTION_CREATED",
    message: `Created subscription for ${customerName} (${productTitle}).`,
    metadata: {
      customerName,
      productTitle,
      interval,
      billingType,
    },
  });

  return json({ ok: true, message: "Subscription created successfully." });
};

export default function CreateSubscriptionPage() {
  const { products } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        label: product.productTitle,
        value: product.id,
      })),
    [products],
  );

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [subscriptionProductId, setSubscriptionProductId] = useState(
    productOptions[0]?.value || "",
  );
  const [interval, setInterval] = useState("MONTHLY");
  const [discountValue, setDiscountValue] = useState("0");
  const [basePrice, setBasePrice] = useState("29");
  const [billingType, setBillingType] = useState("PAY_AS_YOU_GO");
  const [nextOrderDate, setNextOrderDate] = useState(getDefaultNextOrderDate());

  const selectedProduct =
    products.find((product) => product.id === subscriptionProductId) || null;

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page>
      <TitleBar title="Create Subscription" />
      <BlockStack gap="500">
        {actionData?.message ? (
          <Banner tone={actionData.ok ? "success" : "critical"}>
            {actionData.message}
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <Card>
              <Form method="post">
                <input
                  type="hidden"
                  name="subscriptionProductId"
                  value={subscriptionProductId}
                />
                <input
                  type="hidden"
                  name="productTitle"
                  value={selectedProduct?.productTitle || ""}
                />
                <input type="hidden" name="customerName" value={customerName} />
                <input type="hidden" name="customerEmail" value={customerEmail} />
                <input type="hidden" name="interval" value={interval} />
                <input type="hidden" name="discountValue" value={discountValue} />
                <input type="hidden" name="basePrice" value={basePrice} />
                <input type="hidden" name="billingType" value={billingType} />
                <input type="hidden" name="nextOrderDate" value={nextOrderDate} />

                <FormLayout>
                  <TextField
                    label="Customer Name"
                    value={customerName}
                    onChange={setCustomerName}
                    autoComplete="name"
                  />
                  <TextField
                    label="Customer Email"
                    value={customerEmail}
                    onChange={setCustomerEmail}
                    autoComplete="email"
                  />
                  <Select
                    label="Product Dropdown"
                    options={productOptions}
                    value={subscriptionProductId}
                    onChange={setSubscriptionProductId}
                    disabled={productOptions.length === 0}
                  />
                  <Select
                    label="Interval Selector"
                    options={FREQUENCY_OPTIONS}
                    value={interval}
                    onChange={setInterval}
                  />
                  <TextField
                    label="Discount Input"
                    value={discountValue}
                    onChange={setDiscountValue}
                    type="number"
                    min="0"
                    autoComplete="off"
                    suffix="%"
                  />
                  <TextField
                    label="Base Price"
                    value={basePrice}
                    onChange={setBasePrice}
                    type="number"
                    min="0"
                    autoComplete="off"
                    prefix="$"
                  />
                  <Select
                    label="Billing Type"
                    options={BILLING_TYPE_OPTIONS}
                    value={billingType}
                    onChange={setBillingType}
                  />
                  <TextField
                    label="Next Order Date"
                    type="date"
                    value={nextOrderDate}
                    onChange={setNextOrderDate}
                    autoComplete="off"
                  />
                  <Button submit variant="primary" loading={isSubmitting}>
                    Submit
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Setup Status
                </Text>
                <Text as="p" variant="bodyMd">
                  Enabled subscription products: {products.length}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Configure subscription products first if the dropdown is empty.
                </Text>
                <Button url="/app/subscription-products" variant="plain">
                  Open Subscription Products
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
