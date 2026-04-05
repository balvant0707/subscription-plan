import { PrismaClient } from "@prisma/client";

const stripWrappingQuotes = (value) => {
  if (typeof value !== "string") return "";

  let normalized = value.trim();
  while (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
};

const isPostgresUrl = (value) =>
  value.startsWith("postgresql://") || value.startsWith("postgres://");

const rawDatabaseCandidates = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_URL_NON_POOLING,
];

const databaseUrl = rawDatabaseCandidates
  .map(stripWrappingQuotes)
  .find((candidate) => isPostgresUrl(candidate));

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
} else {
  throw new Error(
    "Invalid DATABASE_URL. Set DATABASE_URL (or POSTGRES_PRISMA_URL/POSTGRES_URL) to a value that starts with postgresql:// or postgres://.",
  );
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
