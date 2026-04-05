import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
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
import { createActivity, getShopContext } from "../lib/subscription.server";
import { normalizeFrequencies } from "../lib/subscription.utils";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const widget = await prisma.widgetSetting.findUnique({
    where: { shopId: shop.id },
  });

  return json({
    widget: {
      enabled: widget?.enabled ?? true,
      buyOnceLabel: widget?.buyOnceLabel ?? "Buy once",
      subscribeLabel: widget?.subscribeLabel ?? "Subscribe & save",
      defaultPurchaseOption: widget?.defaultPurchaseOption ?? "BUY_ONCE",
      defaultFrequency: widget?.defaultFrequency ?? "MONTHLY",
      frequencyOptions: normalizeFrequencies(
        String(widget?.frequencyOptions || "WEEKLY,MONTHLY").split(","),
      ),
      addToCartLabel: widget?.addToCartLabel ?? "Add to cart",
    },
  });
};

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const formData = await request.formData();

  const enabled = String(formData.get("enabled") || "true") === "true";
  const buyOnceLabel = String(formData.get("buyOnceLabel") || "Buy once").trim();
  const subscribeLabel = String(
    formData.get("subscribeLabel") || "Subscribe & save",
  ).trim();
  const defaultPurchaseOption = String(
    formData.get("defaultPurchaseOption") || "BUY_ONCE",
  ).toUpperCase();
  const defaultFrequency = String(
    formData.get("defaultFrequency") || "MONTHLY",
  ).toUpperCase();
  const frequencyOptions = normalizeFrequencies(
    String(formData.get("frequencyOptions") || "MONTHLY")
      .split(",")
      .filter(Boolean),
  );
  const addToCartLabel = String(formData.get("addToCartLabel") || "Add to cart").trim();

  await prisma.widgetSetting.upsert({
    where: { shopId: shop.id },
    update: {
      enabled,
      buyOnceLabel,
      subscribeLabel,
      defaultPurchaseOption,
      defaultFrequency,
      frequencyOptions: frequencyOptions.join(","),
      addToCartLabel,
    },
    create: {
      shopId: shop.id,
      enabled,
      buyOnceLabel,
      subscribeLabel,
      defaultPurchaseOption,
      defaultFrequency,
      frequencyOptions: frequencyOptions.join(","),
      addToCartLabel,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "PRODUCT_CONFIG_UPDATED",
    message: "Updated frontend product page widget settings.",
    metadata: { enabled, defaultPurchaseOption, defaultFrequency },
  });

  return json({ ok: true, message: "Widget settings saved." });
};

export default function FrontendProductWidgetPage() {
  const { widget } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [enabled, setEnabled] = useState(widget.enabled);
  const [buyOnceLabel, setBuyOnceLabel] = useState(widget.buyOnceLabel);
  const [subscribeLabel, setSubscribeLabel] = useState(widget.subscribeLabel);
  const [defaultPurchaseOption, setDefaultPurchaseOption] = useState(
    widget.defaultPurchaseOption,
  );
  const [frequencyOptions, setFrequencyOptions] = useState(widget.frequencyOptions);
  const [defaultFrequency, setDefaultFrequency] = useState(widget.defaultFrequency);
  const [addToCartLabel, setAddToCartLabel] = useState(widget.addToCartLabel);

  return (
    <Page>
      <TitleBar title="Frontend Product Page Widget" />
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
                <input type="hidden" name="enabled" value={String(enabled)} />
                <input type="hidden" name="buyOnceLabel" value={buyOnceLabel} />
                <input type="hidden" name="subscribeLabel" value={subscribeLabel} />
                <input
                  type="hidden"
                  name="defaultPurchaseOption"
                  value={defaultPurchaseOption}
                />
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
                <input type="hidden" name="addToCartLabel" value={addToCartLabel} />

                <FormLayout>
                  <ChoiceList
                    title="Widget Status"
                    choices={[{ label: "Enable product page widget", value: "enabled" }]}
                    selected={enabled ? ["enabled"] : []}
                    onChange={(selection) => setEnabled(selection.includes("enabled"))}
                  />
                  <ChoiceList
                    title="Buy Once Radio / Subscribe Radio"
                    choices={[
                      { label: buyOnceLabel || "Buy once", value: "BUY_ONCE" },
                      { label: subscribeLabel || "Subscribe & save", value: "SUBSCRIBE" },
                    ]}
                    selected={[defaultPurchaseOption]}
                    onChange={(selection) =>
                      setDefaultPurchaseOption(selection[0] || "BUY_ONCE")
                    }
                  />
                  <TextField
                    label="Buy Once Label"
                    value={buyOnceLabel}
                    onChange={setBuyOnceLabel}
                    autoComplete="off"
                  />
                  <TextField
                    label="Subscribe Label"
                    value={subscribeLabel}
                    onChange={setSubscribeLabel}
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
                  <TextField
                    label="Add to Cart Button"
                    value={addToCartLabel}
                    onChange={setAddToCartLabel}
                    autoComplete="off"
                  />
                  <Button submit variant="primary" loading={isSaving}>
                    Save Widget
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Widget Preview
                </Text>
                <Text as="p" variant="bodyMd">
                  {buyOnceLabel} / {subscribeLabel}
                </Text>
                <Text as="p" variant="bodyMd">
                  Default frequency: {defaultFrequency}
                </Text>
                <Button disabled>{addToCartLabel}</Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
