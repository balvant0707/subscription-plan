import { json } from "@remix-run/node";
import prisma from "../db.server";
import { fetchProducts } from "../lib/shopify-products.server";
import { getShopContext } from "../lib/subscription.server";
import { normalizeFrequencies } from "../lib/subscription.utils";

export const loader = async ({ request }) => {
  const { admin, shop } = await getShopContext(request);

  const [products, subscriptionProducts] = await Promise.all([
    fetchProducts(admin),
    prisma.subscriptionProduct.findMany({
      where: { shopId: shop.id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const configuredMap = new Map(
    subscriptionProducts.map((item) => [item.shopifyProductId, item]),
  );

  return json({
    products: products.map((product) => {
      const configuration = configuredMap.get(product.id);

      return {
        id: product.id,
        title: product.title,
        price: product.price,
        subscriptionEnabled: configuration?.enabled ?? false,
        defaultFrequency: configuration?.defaultFrequency ?? "MONTHLY",
        discountValue: configuration?.discountValue ?? 0,
        frequencies: normalizeFrequencies(
          String(configuration?.frequencyOptions || "MONTHLY").split(","),
        ),
      };
    }),
  });
};

