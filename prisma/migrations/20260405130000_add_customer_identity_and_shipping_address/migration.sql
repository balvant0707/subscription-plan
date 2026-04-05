-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "customerGid" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "shippingAddressLine1" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "shippingAddressLine2" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "shippingCity" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "shippingProvince" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "shippingCountry" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "shippingZip" TEXT;

-- CreateIndex
CREATE INDEX "subscriptions_shopId_customerGid_idx" ON "subscriptions"("shopId", "customerGid");
