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
  Text,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { DEFAULT_EMAIL_TEMPLATE } from "../lib/subscription.constants";
import { createActivity, getShopContext } from "../lib/subscription.server";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const settings = await prisma.appSetting.findUnique({
    where: { shopId: shop.id },
  });

  return json({
    settings: {
      retryPayment: settings?.retryPayment ?? true,
      emailNotifications: settings?.emailNotifications ?? true,
      cancellationOffer:
        settings?.cancellationOffer ?? "Offer 10% off before canceling.",
      emailTemplate: settings?.emailTemplate ?? DEFAULT_EMAIL_TEMPLATE,
    },
  });
};

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const formData = await request.formData();

  const retryPayment = String(formData.get("retryPayment") || "false") === "true";
  const emailNotifications =
    String(formData.get("emailNotifications") || "false") === "true";
  const cancellationOffer =
    String(
      formData.get("cancellationOffer") || "Offer 10% off before canceling.",
    ).trim() || "Offer 10% off before canceling.";
  const emailTemplate =
    String(formData.get("emailTemplate") || DEFAULT_EMAIL_TEMPLATE).trim() ||
    DEFAULT_EMAIL_TEMPLATE;

  await prisma.appSetting.upsert({
    where: { shopId: shop.id },
    update: {
      retryPayment,
      emailNotifications,
      cancellationOffer,
      emailTemplate,
    },
    create: {
      shopId: shop.id,
      retryPayment,
      emailNotifications,
      cancellationOffer,
      emailTemplate,
    },
  });

  await createActivity({
    shopId: shop.id,
    type: "SETTINGS_UPDATED",
    message: "Updated retry payment and notification settings.",
    metadata: { retryPayment, emailNotifications, cancellationOffer },
  });

  return json({ ok: true, message: "Settings saved." });
};

export default function SettingsPage() {
  const { settings } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [retryPayment, setRetryPayment] = useState(settings.retryPayment);
  const [emailNotifications, setEmailNotifications] = useState(
    settings.emailNotifications,
  );
  const [cancellationOffer, setCancellationOffer] = useState(
    settings.cancellationOffer,
  );
  const [emailTemplate, setEmailTemplate] = useState(settings.emailTemplate);

  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        {actionData?.message ? <Banner tone="success">{actionData.message}</Banner> : null}

        <Layout>
          <Layout.Section>
            <Card>
              <Form method="post">
                <input
                  type="hidden"
                  name="retryPayment"
                  value={String(retryPayment)}
                />
                <input
                  type="hidden"
                  name="emailNotifications"
                  value={String(emailNotifications)}
                />
                <input
                  type="hidden"
                  name="cancellationOffer"
                  value={cancellationOffer}
                />
                <input type="hidden" name="emailTemplate" value={emailTemplate} />

                <FormLayout>
                  <ChoiceList
                    title="Retry Payment"
                    choices={[
                      {
                        label: "Enable automatic retry on failed payments",
                        value: "retry-payment",
                      },
                    ]}
                    selected={retryPayment ? ["retry-payment"] : []}
                    onChange={(selection) =>
                      setRetryPayment(selection.includes("retry-payment"))
                    }
                  />
                  <ChoiceList
                    title="Email Notifications"
                    choices={[
                      {
                        label: "Enable email notifications to subscribers",
                        value: "email-notifications",
                      },
                    ]}
                    selected={emailNotifications ? ["email-notifications"] : []}
                    onChange={(selection) =>
                      setEmailNotifications(selection.includes("email-notifications"))
                    }
                  />
                  <TextField
                    label="Cancellation Offer"
                    value={cancellationOffer}
                    onChange={setCancellationOffer}
                    autoComplete="off"
                  />
                  <TextField
                    label="Email Template"
                    value={emailTemplate}
                    onChange={setEmailTemplate}
                    multiline={6}
                    autoComplete="off"
                  />
                  <Button submit variant="primary" loading={isSaving}>
                    Save Settings
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Frontend Pages
                </Text>
                <Text as="p" variant="bodyMd">
                  Manage the storefront widget and customer portal behavior.
                </Text>
                <Button url="/app/widget">Frontend Product Page Widget</Button>
                <Button url="/app/portal" variant="secondary">
                  Customer Portal
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
