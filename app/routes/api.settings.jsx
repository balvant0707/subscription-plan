import { json } from "@remix-run/node";
import prisma from "../db.server";
import { DEFAULT_EMAIL_TEMPLATE } from "../lib/subscription.constants";
import { createActivity, getShopContext } from "../lib/subscription.server";

export const action = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const retryPayment = Boolean(payload.retryPayment);
  const emailNotifications = Boolean(payload.emailNotifications);
  const cancellationOffer =
    String(payload.cancellationOffer || "Offer 10% off before canceling.").trim() ||
    "Offer 10% off before canceling.";
  const emailTemplate =
    String(payload.emailTemplate || DEFAULT_EMAIL_TEMPLATE).trim() ||
    DEFAULT_EMAIL_TEMPLATE;

  const settings = await prisma.appSetting.upsert({
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
    message: "Updated app settings from API.",
    metadata: { retryPayment, emailNotifications, cancellationOffer },
  });

  return json({ ok: true, settings });
};

