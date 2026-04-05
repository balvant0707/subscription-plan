-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubscriptionProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" REAL NOT NULL DEFAULT 0,
    "frequencyOptions" TEXT NOT NULL,
    "defaultFrequency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "subscriptionProductId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "productTitle" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "basePrice" REAL NOT NULL DEFAULT 0,
    "discountValue" REAL NOT NULL DEFAULT 0,
    "billingType" TEXT NOT NULL DEFAULT 'PAY_AS_YOU_GO',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "nextOrderDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "SubscriptionProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "retryPayment" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "emailTemplate" TEXT NOT NULL DEFAULT 'Hi {{customer_name}}, your subscription payment failed. Please update your payment method.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopPricingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'STARTER',
    "priceMonthly" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopPricingPlan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WidgetSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "buyOnceLabel" TEXT NOT NULL DEFAULT 'Buy once',
    "subscribeLabel" TEXT NOT NULL DEFAULT 'Subscribe & save',
    "defaultPurchaseOption" TEXT NOT NULL DEFAULT 'BUY_ONCE',
    "defaultFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "frequencyOptions" TEXT NOT NULL DEFAULT 'WEEKLY,MONTHLY',
    "addToCartLabel" TEXT NOT NULL DEFAULT 'Add to cart',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WidgetSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionProduct_shopId_shopifyProductId_key" ON "SubscriptionProduct"("shopId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "Subscription_shopId_status_idx" ON "Subscription"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_shopId_key" ON "AppSetting"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPricingPlan_shopId_key" ON "ShopPricingPlan"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetSetting_shopId_key" ON "WidgetSetting"("shopId");

-- CreateIndex
CREATE INDEX "Activity_shopId_createdAt_idx" ON "Activity"("shopId", "createdAt");
