import { json } from "@remix-run/node";
import prisma from "../db.server";
import { getShopContext } from "../lib/subscription.server";
import { normalizeFrequencies } from "../lib/subscription.utils";

export const loader = async ({ request }) => {
  const { shop } = await getShopContext(request);
  const url = new URL(request.url);
  const shopifyProductId = String(url.searchParams.get("productId") || "").trim();

  const [widget, productConfig] = await Promise.all([
    prisma.widgetSetting.findUnique({ where: { shopId: shop.id } }),
    shopifyProductId
      ? prisma.subscriptionProduct.findUnique({
          where: {
            shopId_shopifyProductId: {
              shopId: shop.id,
              shopifyProductId,
            },
          },
        })
      : Promise.resolve(null),
  ]);

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
    productConfig: productConfig
      ? {
          shopifyProductId: productConfig.shopifyProductId,
          productTitle: productConfig.productTitle,
          enabled: productConfig.enabled,
          discountType: productConfig.discountType,
          discountValue: productConfig.discountValue,
          defaultFrequency: productConfig.defaultFrequency,
          frequencyOptions: normalizeFrequencies(
            productConfig.frequencyOptions.split(","),
          ),
        }
      : null,
  });
};

