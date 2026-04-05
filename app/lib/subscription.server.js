import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { upsertInstalledShop } from "./shop.server";

export async function getShopContext(request) {
  const { admin, session } = await authenticate.admin(request);

  const shop = await upsertInstalledShop({
    shopDomain: session.shop,
    accessToken: session.accessToken,
    admin,
  });

  return { admin, session, shop };
}

export async function createActivity({ shopId, type, message, metadata }) {
  await prisma.activity.create({
    data: {
      shopId,
      type,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
