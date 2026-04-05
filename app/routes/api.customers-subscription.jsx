import { json } from "@remix-run/node";
import prisma from "../db.server";
import { getShopContext } from "../lib/subscription.server";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);

  const subscriptions = await prisma.subscription.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  return json({
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      customerGid: subscription.customerGid,
      customerName: subscription.customerName,
      customerEmail: subscription.customerEmail,
      productTitle: subscription.productTitle,
      status: subscription.status,
      interval: subscription.interval,
      nextOrderDate: subscription.nextOrderDate,
      billingType: subscription.billingType,
      discountValue: subscription.discountValue,
      shippingAddressLine1: subscription.shippingAddressLine1,
      shippingAddressLine2: subscription.shippingAddressLine2,
      shippingCity: subscription.shippingCity,
      shippingProvince: subscription.shippingProvince,
      shippingCountry: subscription.shippingCountry,
      shippingZip: subscription.shippingZip,
    })),
  });
};
