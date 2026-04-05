import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  ChoiceList,
  FormLayout,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { FREQUENCY_OPTIONS } from "../lib/subscription.constants";
import { fetchProducts } from "../lib/shopify-products.server";
import {
  createActivity,
  getShopContext,
} from "../lib/subscription.server";
import { normalizeFrequencies, parseNumber } from "../lib/subscription.utils";

export const loader = async ({ request }) => {
  const { admin, shop } = await getShopContext(request);

  const [shopifyProducts, configuredProducts] = await Promise.all([
    fetchProducts(admin),
    prisma.subscriptionProduct.findMany({
      where: { shopId: shop.id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const fallbackProducts = configuredProducts.map((product) => ({
    id: product.shopifyProductId,
    title: product.productTitle,
    price: 0,
  }));

  const sourceProducts =
    shopifyProducts.length > 0 ? shopifyProducts : fallbackProducts;

  const productOptions = sourceProducts.map((product) => ({
    label: product.title,
    value: product.id,
    price: product.price,
  }));

  return json({
    productOptions,
    configuredProducts: configuredProducts.map((product) => ({
      ...product,
      frequencyOptions: normalizeFrequencies(product.frequencyOptions.split(",")),
    })),
  });
};

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const formData = await request.formData();

  const shopifyProductId = String(formData.get("shopifyProductId") || "").trim();
  const productTitle = String(formData.get("productTitle") || "").trim();
  const enabled = String(formData.get("enabled") || "false") === "true";
  const discountType = String(formData.get("discountType") || "PERCENTAGE");
  const discountValue = parseNumber(formData.get("discountValue"), 0);
  const defaultFrequency = String(
    formData.get("defaultFrequency") || "MONTHLY",
  ).toUpperCase();
  const frequencyOptions = normalizeFrequencies(
    String(formData.get("frequencyOptions") || "")
      .split(",")
      .filter(Boolean),
  );

  if (!shopifyProductId || !productTitle) {
    return json(
      { ok: false, message: "Select a valid product before saving." },
      { status: 400 },
    );
  }

  if (frequencyOptions.length === 0) {
    return json(
      { ok: false, message: "Select at least one frequency option." },
      { status: 400 },
    );
  }

  await prisma.subscriptionProduct.upsert({
    where: {
      shopId_shopifyProductId: {
        shopId: shop.id,
        shopifyProductId,
      },
    },
    update: {
      productTitle,
      enabled,
      discountType,
      discountValue,
      frequencyOptions: frequencyOptions.join(","),
      defaultFrequency,
    },
    create: {
      shopId: shop.id,
      shopifyProductId,
      productTitle,
      enabled,
      discountType,
      discountValue,
      frequencyOptions: frequencyOptions.join(","),
      defaultFrequency,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "PRODUCT_CONFIG_UPDATED",
    message: `Updated subscription settings for ${productTitle}.`,
    metadata: { shopifyProductId, enabled, defaultFrequency },
  });

  return json({ ok: true, message: "Subscription product settings saved." });
};

export default function SubscriptionProductsPage() {
  const { productOptions, configuredProducts } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const configuredMap = useMemo(() => {
    const map = {};
    configuredProducts.forEach((product) => {
      map[product.shopifyProductId] = product;
    });
    return map;
  }, [configuredProducts]);

  const defaultProductId = productOptions[0]?.value || "";
  const [selectedProductId, setSelectedProductId] = useState(defaultProductId);
  const [enabled, setEnabled] = useState(true);
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("0");
  const [frequencyOptions, setFrequencyOptions] = useState(["MONTHLY"]);
  const [defaultFrequency, setDefaultFrequency] = useState("MONTHLY");

  useEffect(() => {
    if (!selectedProductId) {
      return;
    }

    const config = configuredMap[selectedProductId];

    if (!config) {
      setEnabled(true);
      setDiscountType("PERCENTAGE");
      setDiscountValue("0");
      setFrequencyOptions(["MONTHLY"]);
      setDefaultFrequency("MONTHLY");
      return;
    }

    const productFrequencies =
      config.frequencyOptions.length > 0 ? config.frequencyOptions : ["MONTHLY"];

    setEnabled(config.enabled);
    setDiscountType(config.discountType);
    setDiscountValue(String(config.discountValue));
    setFrequencyOptions(productFrequencies);
    setDefaultFrequency(config.defaultFrequency || productFrequencies[0]);
  }, [configuredMap, selectedProductId]);

  const selectedProduct = productOptions.find(
    (product) => product.value === selectedProductId,
  );

  return (
    <Page>
      <TitleBar title="Subscription Products" />
      <BlockStack gap="500">
        {actionData?.message ? (
          <Banner tone={actionData.ok ? "success" : "critical"}>
            {actionData.message}
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <Card>
              {productOptions.length === 0 ? (
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Product Selector
                  </Text>
                  <Text as="p" variant="bodyMd">
                    No Shopify products found yet. Add products in your store, then
                    return to configure subscription settings.
                  </Text>
                </BlockStack>
              ) : (
                <Form method="post">
                  <input
                    type="hidden"
                    name="shopifyProductId"
                    value={selectedProductId}
                  />
                  <input
                    type="hidden"
                    name="productTitle"
                    value={selectedProduct?.label || ""}
                  />
                  <input type="hidden" name="enabled" value={String(enabled)} />
                  <input type="hidden" name="discountType" value={discountType} />
                  <input type="hidden" name="discountValue" value={discountValue} />
                  <input
                    type="hidden"
                    name="frequencyOptions"
                    value={frequencyOptions.join(",")}
                  />
                  <input
                    type="hidden"
                    name="defaultFrequency"
                    value={defaultFrequency}
                  />

                  <FormLayout>
                    <Select
                      label="Product Selector"
                      options={productOptions}
                      value={selectedProductId}
                      onChange={setSelectedProductId}
                    />
                    <ChoiceList
                      title="Subscription Toggle"
                      choices={[
                        { label: "Enable subscription for this product", value: "enabled" },
                      ]}
                      selected={enabled ? ["enabled"] : []}
                      onChange={(selection) => setEnabled(selection.includes("enabled"))}
                    />
                    <Select
                      label="Discount Type"
                      options={[
                        { label: "Percentage", value: "PERCENTAGE" },
                        { label: "Fixed", value: "FIXED" },
                      ]}
                      value={discountType}
                      onChange={setDiscountType}
                    />
                    <TextField
                      label="Discount Input"
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={setDiscountValue}
                      suffix={discountType === "PERCENTAGE" ? "%" : "$"}
                      autoComplete="off"
                    />
                    <ChoiceList
                      title="Frequency Options"
                      allowMultiple
                      choices={FREQUENCY_OPTIONS}
                      selected={frequencyOptions}
                      onChange={(values) => {
                        const normalized = normalizeFrequencies(values);
                        setFrequencyOptions(normalized);
                        if (!normalized.includes(defaultFrequency)) {
                          setDefaultFrequency(normalized[0] || "MONTHLY");
                        }
                      }}
                    />
                    <Select
                      label="Frequency Dropdown"
                      options={FREQUENCY_OPTIONS.filter((option) =>
                        frequencyOptions.includes(option.value),
                      )}
                      value={defaultFrequency}
                      onChange={setDefaultFrequency}
                    />
                    <Button submit variant="primary" loading={isSaving}>
                      Save
                    </Button>
                  </FormLayout>
                </Form>
              )}
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Create Subscription
                </Text>
                <Text as="p" variant="bodyMd">
                  After enabling subscription on a product, use the create page to
                  add customer subscriptions and billing preferences.
                </Text>
                <Button url="/app/create-subscription">Go to Create Subscription</Button>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Configured Products
                </Text>
                {configuredProducts.length === 0 ? (
                  <Text as="p" variant="bodyMd">
                    No products configured yet.
                  </Text>
                ) : (
                  configuredProducts.map((product) => (
                    <BlockStack key={product.id} gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        {product.productTitle}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {product.enabled ? "Enabled" : "Disabled"} •{" "}
                        {product.frequencyOptions.join(", ")}
                      </Text>
                    </BlockStack>
                  ))
                )}
                <Text as="p" variant="bodySm" tone="subdued">
                  Need product setup help? Configure products in Shopify Admin first.
                </Text>
                <Link to="/app/customers">View Customer Subscriptions</Link>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
