import prisma from "../db.server";

const SHOP_DETAILS_QUERY = `#graphql
  query ShopDetails {
    shop {
      name
      email
      contactEmail
      currencyCode
      shopOwnerName
      billingAddress {
        country
        city
        phone
      }
      primaryDomain {
        host
      }
    }
  }
`;

function normalizeShopDomain(shopDomain) {
  return String(shopDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0];
}

async function fetchShopDetails(admin) {
  if (!admin?.graphql) {
    return null;
  }

  try {
    const response = await admin.graphql(SHOP_DETAILS_QUERY);
    const json = await response.json();
    return json?.data?.shop ?? null;
  } catch (error) {
    console.error("Failed to fetch shop details from Shopify Admin API.", error);
    return null;
  }
}

function buildShopData({ details, accessToken, installed, status }) {
  return {
    accessToken: typeof accessToken === "string" ? accessToken : "",
    installed,
    status,
    ownerName: details?.shopOwnerName ?? null,
    email: details?.email ?? null,
    contactEmail: details?.contactEmail ?? null,
    name: details?.name ?? null,
    country: details?.billingAddress?.country ?? null,
    city: details?.billingAddress?.city ?? null,
    currency: details?.currencyCode ?? null,
    phone: details?.billingAddress?.phone ?? null,
    primaryDomain: details?.primaryDomain?.host ?? null,
  };
}

export async function upsertInstalledShop({
  shopDomain,
  accessToken,
  admin,
}) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  if (!normalizedShopDomain) {
    throw new Error("Cannot upsert shop without a valid shop domain.");
  }

  const details = await fetchShopDetails(admin);
  const createData = buildShopData({
    details,
    accessToken,
    installed: true,
    status: "installed",
  });

  const updateData = {
    ...createData,
    accessToken:
      typeof accessToken === "string" && accessToken.length > 0
        ? accessToken
        : undefined,
  };

  return prisma.shop.upsert({
    where: { shopDomain: normalizedShopDomain },
    update: updateData,
    create: {
      shopDomain: normalizedShopDomain,
      ...createData,
    },
  });
}

export async function ensureShopRecord(shopDomain) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  if (!normalizedShopDomain) {
    return null;
  }

  return prisma.shop.upsert({
    where: { shopDomain: normalizedShopDomain },
    update: {},
    create: {
      shopDomain: normalizedShopDomain,
      accessToken: "",
      installed: true,
      status: "installed",
    },
  });
}

export async function markShopUninstalled(shopDomain) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);
  if (!normalizedShopDomain) {
    return null;
  }

  return prisma.shop.upsert({
    where: { shopDomain: normalizedShopDomain },
    update: {
      accessToken: "",
      installed: false,
      status: "uninstalled",
    },
    create: {
      shopDomain: normalizedShopDomain,
      accessToken: "",
      installed: false,
      status: "uninstalled",
    },
  });
}
