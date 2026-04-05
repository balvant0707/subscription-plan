-- AlterTable
ALTER TABLE "Shop"
ADD COLUMN "accessToken" TEXT NOT NULL DEFAULT '',
ADD COLUMN "installed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "status" VARCHAR(32) DEFAULT 'installed',
ADD COLUMN "ownerName" VARCHAR(255),
ADD COLUMN "email" VARCHAR(320),
ADD COLUMN "contactEmail" VARCHAR(320),
ADD COLUMN "name" VARCHAR(255),
ADD COLUMN "country" VARCHAR(100),
ADD COLUMN "city" VARCHAR(100),
ADD COLUMN "currency" VARCHAR(10),
ADD COLUMN "phone" VARCHAR(50),
ADD COLUMN "primaryDomain" VARCHAR(255);

-- Keep schema and migration behavior aligned:
-- field remains required in Prisma but has no DB-level default after migration.
ALTER TABLE "Shop"
ALTER COLUMN "accessToken" DROP DEFAULT;
