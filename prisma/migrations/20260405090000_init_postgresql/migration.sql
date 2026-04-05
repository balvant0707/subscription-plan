-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('PAY_AS_YOU_GO', 'PREPAID');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PricingTier" AS ENUM ('STARTER', 'GROWTH', 'PRO');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_PAUSED', 'SUBSCRIPTION_CANCELED', 'SUBSCRIPTION_SKIPPED', 'PRODUCT_CONFIG_UPDATED', 'SETTINGS_UPDATED', 'PLAN_CHANGED', 'PORTAL_UPDATED');

-- CreateEnum
CREATE TYPE "PurchaseOption" AS ENUM ('BUY_ONCE', 'SUBSCRIBE');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_products" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frequencyOptions" TEXT NOT NULL,
    "defaultFrequency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "subscriptionProductId" TEXT,
    "customerGid" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "productTitle" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingType" "BillingType" NOT NULL DEFAULT 'PAY_AS_YOU_GO',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "shippingAddressLine1" TEXT,
    "shippingAddressLine2" TEXT,
    "shippingCity" TEXT,
    "shippingProvince" TEXT,
    "shippingCountry" TEXT,
    "shippingZip" TEXT,
    "nextOrderDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_orders" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "shopifyOrderId" TEXT NOT NULL,
    "orderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "retryPayment" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "cancellationOffer" TEXT NOT NULL DEFAULT 'Offer 10% off before canceling.',
    "emailTemplate" TEXT NOT NULL DEFAULT 'Hi {{customer_name}}, your subscription payment failed. Please update your payment method.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPricingPlan" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "plan" "PricingTier" NOT NULL DEFAULT 'STARTER',
    "priceMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPricingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetSetting" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "buyOnceLabel" TEXT NOT NULL DEFAULT 'Buy once',
    "subscribeLabel" TEXT NOT NULL DEFAULT 'Subscribe & save',
    "defaultPurchaseOption" "PurchaseOption" NOT NULL DEFAULT 'BUY_ONCE',
    "defaultFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "frequencyOptions" TEXT NOT NULL DEFAULT 'WEEKLY,MONTHLY',
    "addToCartLabel" TEXT NOT NULL DEFAULT 'Add to cart',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_logs" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_products_shopId_shopifyProductId_key" ON "subscription_products"("shopId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "subscriptions_shopId_status_idx" ON "subscriptions"("shopId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_shopId_customerGid_idx" ON "subscriptions"("shopId", "customerGid");

-- CreateIndex
CREATE INDEX "subscription_orders_shopId_orderDate_idx" ON "subscription_orders"("shopId", "orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_shopId_shopifyOrderId_key" ON "subscription_orders"("shopId", "shopifyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_shopId_key" ON "AppSetting"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPricingPlan_shopId_key" ON "ShopPricingPlan"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetSetting_shopId_key" ON "WidgetSetting"("shopId");

-- CreateIndex
CREATE INDEX "subscription_logs_shopId_createdAt_idx" ON "subscription_logs"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "subscription_products" ADD CONSTRAINT "subscription_products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPricingPlan" ADD CONSTRAINT "ShopPricingPlan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetSetting" ADD CONSTRAINT "WidgetSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_logs" ADD CONSTRAINT "subscription_logs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;