import { PrismaClient } from "@prisma/client";

const DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
];

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

const normalizeRawDatabaseValue = (value) => {
  let normalized = stripWrappingQuotes(value);
  if (!normalized) return "";

  const assignmentMatch = normalized.match(
    /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.+)$/,
  );
  if (assignmentMatch) {
    normalized = stripWrappingQuotes(assignmentMatch[1]);
  }

  normalized = stripWrappingQuotes(normalized.replace(/;+$/, ""));

  if (normalized.startsWith("prisma+postgres://")) {
    normalized = normalized.replace("prisma+postgres://", "postgres://");
  } else if (normalized.startsWith("prisma+postgresql://")) {
    normalized = normalized.replace("prisma+postgresql://", "postgresql://");
  } else if (normalized.startsWith("//")) {
    normalized = `postgresql:${normalized}`;
  } else if (
    normalized.startsWith("postgresql:") &&
    !normalized.startsWith("postgresql://")
  ) {
    normalized = normalized.replace("postgresql:", "postgresql://");
  } else if (
    normalized.startsWith("postgres:") &&
    !normalized.startsWith("postgres://")
  ) {
    normalized = normalized.replace("postgres:", "postgres://");
  } else if (
    !normalized.includes("://") &&
    /^[^:@/\s]+(?::[^@/\s]*)?@[^/\s]+\/.+$/.test(normalized)
  ) {
    normalized = `postgresql://${normalized}`;
  }

  return normalized;
};

const isPostgresUrl = (value) =>
  typeof value === "string" &&
  (value.startsWith("postgresql://") || value.startsWith("postgres://"));

const buildDatabaseUrlFromParts = () => {
  const host = stripWrappingQuotes(process.env.POSTGRES_HOST || process.env.PGHOST);
  const user = stripWrappingQuotes(process.env.POSTGRES_USER || process.env.PGUSER);
  const password = stripWrappingQuotes(
    process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD,
  );
  const port = stripWrappingQuotes(process.env.POSTGRES_PORT || process.env.PGPORT) || "5432";
  const database =
    stripWrappingQuotes(process.env.POSTGRES_DATABASE || process.env.PGDATABASE) ||
    "postgres";

  if (!host || !user) return "";

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = password ? `:${encodeURIComponent(password)}` : "";
  const encodedDatabase = encodeURIComponent(database);

  return `postgresql://${encodedUser}${encodedPassword}@${host}:${port}/${encodedDatabase}`;
};

const databaseUrl =
  DATABASE_URL_KEYS.map((key) => normalizeRawDatabaseValue(process.env[key])).find(
    (candidate) => isPostgresUrl(candidate),
  ) || buildDatabaseUrlFromParts();

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
} else {
  const detectedSchemes = DATABASE_URL_KEYS.map((key) =>
    normalizeRawDatabaseValue(process.env[key]),
  )
    .filter(Boolean)
    .map((candidate) => {
      const match = candidate.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\//);
      return match ? match[1] : "missing-protocol";
    });
  const schemeInfo =
    detectedSchemes.length > 0
      ? ` Received schemes: ${[...new Set(detectedSchemes)].join(", ")}.`
      : "";

  throw new Error(
    "Invalid DATABASE_URL. Set DATABASE_URL (or POSTGRES_PRISMA_URL/POSTGRES_URL) to a value that starts with postgresql:// or postgres://." +
      schemeInfo,
  );
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
