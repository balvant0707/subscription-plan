import { json } from "@remix-run/node";
import prisma from "../db.server";
import { normalizeFrequencies } from "../lib/subscription.utils";
import { authenticate } from "../shopify.server";
import { ensureShopRecord } from "../lib/shop.server";

const DEFAULT_WIDGET = {
  enabled: true,
  buyOnceLabel: "Buy once",
  subscribeLabel: "Subscribe & save",
  defaultPurchaseOption: "BUY_ONCE",
  defaultFrequency: "MONTHLY",
  frequencyOptions: ["WEEKLY", "MONTHLY"],
  addToCartLabel: "Add to cart",
};

export const loader = async ({ request }) => {
  await authenticate.public.appProxy(request);
  const url = new URL(request.url);

  const shopDomain = getShopDomain(url);
  if (!shopDomain) {
    return json({ widget: DEFAULT_WIDGET, productConfig: null });
  }

  const productIdentifiers = getProductIdentifiers(
    String(url.searchParams.get("productId") || "").trim(),
  );

  const shop = await ensureShopRecord(shopDomain);
  if (!shop) {
    return json({ widget: DEFAULT_WIDGET, productConfig: null });
  }

  const [widget, productConfig] = await Promise.all([
    prisma.widgetSetting.findUnique({
      where: { shopId: shop.id },
    }),
    productIdentifiers.length > 0
      ? prisma.subscriptionProduct.findFirst({
          where: {
            shopId: shop.id,
            shopifyProductId: {
              in: productIdentifiers,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const widgetSettings = {
    enabled: widget?.enabled ?? DEFAULT_WIDGET.enabled,
    buyOnceLabel: widget?.buyOnceLabel ?? DEFAULT_WIDGET.buyOnceLabel,
    subscribeLabel: widget?.subscribeLabel ?? DEFAULT_WIDGET.subscribeLabel,
    defaultPurchaseOption:
      widget?.defaultPurchaseOption ?? DEFAULT_WIDGET.defaultPurchaseOption,
    defaultFrequency: widget?.defaultFrequency ?? DEFAULT_WIDGET.defaultFrequency,
    frequencyOptions: normalizeFrequencies(
      String(widget?.frequencyOptions || DEFAULT_WIDGET.frequencyOptions.join(",")).split(
        ",",
      ),
    ),
    addToCartLabel: widget?.addToCartLabel ?? DEFAULT_WIDGET.addToCartLabel,
  };

  const normalizedProductConfig = productConfig
    ? {
        shopifyProductId: productConfig.shopifyProductId,
        productTitle: productConfig.productTitle,
        enabled: productConfig.enabled,
        discountType: productConfig.discountType,
        discountValue: productConfig.discountValue,
        defaultFrequency: productConfig.defaultFrequency,
        frequencyOptions: normalizeFrequencies(productConfig.frequencyOptions.split(",")),
      }
    : null;

  if (normalizedProductConfig && !normalizedProductConfig.enabled) {
    widgetSettings.enabled = false;
  }

  if (normalizedProductConfig?.defaultFrequency) {
    widgetSettings.defaultFrequency = normalizedProductConfig.defaultFrequency;
  }

  if (normalizedProductConfig?.frequencyOptions?.length) {
    widgetSettings.frequencyOptions = normalizedProductConfig.frequencyOptions;
  }

  return json({
    widget: widgetSettings,
    productConfig: normalizedProductConfig,
  });
};

function getShopDomain(url) {
  const shopParam = String(url.searchParams.get("shop") || "").trim().toLowerCase();
  if (!shopParam) {
    return "";
  }

  return shopParam.replace(/^https?:\/\//, "").split("/")[0];
}

function getProductIdentifiers(productId) {
  if (!productId) {
    return [];
  }

  const identifiers = [productId];
  if (!productId.startsWith("gid://")) {
    identifiers.push(`gid://shopify/Product/${productId}`);
  }

  return identifiers;
}
