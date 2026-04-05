/*
  Warnings:

  - You are about to drop the `Activity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubscriptionProduct` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "Activity_shopId_createdAt_idx";

-- DropIndex
DROP INDEX "Subscription_shopId_status_idx";

-- DropIndex
DROP INDEX "SubscriptionProduct_shopId_shopifyProductId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Activity";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Subscription";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SubscriptionProduct";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "subscription_products" (
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
    CONSTRAINT "subscription_products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subscriptions" (
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
    CONSTRAINT "subscriptions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_subscriptionProductId_fkey" FOREIGN KEY ("subscriptionProductId") REFERENCES "subscription_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subscription_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "shopifyOrderId" TEXT NOT NULL,
    "orderAmount" REAL NOT NULL DEFAULT 0,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_orders_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscription_orders_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subscription_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_logs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "retryPayment" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "cancellationOffer" TEXT NOT NULL DEFAULT 'Offer 10% off before canceling.',
    "emailTemplate" TEXT NOT NULL DEFAULT 'Hi {{customer_name}}, your subscription payment failed. Please update your payment method.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AppSetting" ("createdAt", "emailNotifications", "emailTemplate", "id", "retryPayment", "shopId", "updatedAt") SELECT "createdAt", "emailNotifications", "emailTemplate", "id", "retryPayment", "shopId", "updatedAt" FROM "AppSetting";
DROP TABLE "AppSetting";
ALTER TABLE "new_AppSetting" RENAME TO "AppSetting";
CREATE UNIQUE INDEX "AppSetting_shopId_key" ON "AppSetting"("shopId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "subscription_products_shopId_shopifyProductId_key" ON "subscription_products"("shopId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "subscriptions_shopId_status_idx" ON "subscriptions"("shopId", "status");

-- CreateIndex
CREATE INDEX "subscription_orders_shopId_orderDate_idx" ON "subscription_orders"("shopId", "orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_shopId_shopifyOrderId_key" ON "subscription_orders"("shopId", "shopifyOrderId");

-- CreateIndex
CREATE INDEX "subscription_logs_shopId_createdAt_idx" ON "subscription_logs"("shopId", "createdAt");
