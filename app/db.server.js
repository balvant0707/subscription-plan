import { PrismaClient } from "@prisma/client";

const DATABASE_URL_KEYS = [
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_POOLER_URL",
  "SUPABASE_POOLER_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_DATABASE_URL",
  "DATABASE_URL",
  "POSTGRES_URL_NON_POOLING",
  "DIRECT_URL",
];

const connectionMode = String(process.env.PRISMA_DB_CONNECTION_MODE || "")
  .trim()
  .toLowerCase();
const forceDirectMode = connectionMode === "direct";

const DIRECT_KEYS = new Set(["DATABASE_URL", "POSTGRES_URL_NON_POOLING", "DIRECT_URL"]);
const POOLER_KEYS = new Set([
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_POOLER_URL",
  "SUPABASE_POOLER_URL",
]);

const SUPABASE_POOLER_HOST_KEYS = [
  "SUPABASE_DB_POOLER_HOST",
  "SUPABASE_POOLER_HOST",
];

const SUPABASE_REGION_KEYS = [
  "SUPABASE_REGION",
  "SUPABASE_DB_REGION",
  "SUPABASE_POOLER_REGION",
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

const isLikelySupabaseDirectUrl = (value) => {
  if (!isPostgresUrl(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isDirectHost = /^db\.[a-z0-9]+\.supabase\.co$/.test(host);
    const port = parsed.port || "5432";

    return isDirectHost && port === "5432";
  } catch (error) {
    return false;
  }
};

const tryConvertSupabaseDirectToPooler = (value) => {
  if (!isLikelySupabaseDirectUrl(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const match = parsed.hostname.toLowerCase().match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    const projectRef = match?.[1];
    if (!projectRef) {
      return value;
    }

    let poolerHost = SUPABASE_POOLER_HOST_KEYS.map((key) =>
      stripWrappingQuotes(process.env[key]),
    ).find(Boolean);

    if (!poolerHost) {
      const region = SUPABASE_REGION_KEYS.map((key) =>
        stripWrappingQuotes(process.env[key]),
      ).find(Boolean);

      if (region) {
        poolerHost = `aws-0-${region}.pooler.supabase.com`;
      }
    }

    if (!poolerHost) {
      return value;
    }

    const poolerPort =
      stripWrappingQuotes(process.env.SUPABASE_POOLER_PORT) || "6543";

    const currentUser = parsed.username || "postgres";
    const poolerUser = currentUser.includes(".")
      ? currentUser
      : `${currentUser}.${projectRef}`;

    parsed.hostname = poolerHost;
    parsed.port = poolerPort;
    parsed.username = poolerUser;
    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }

    return parsed.toString();
  } catch (error) {
    return value;
  }
};

const finalizePostgresUrl = (value) => {
  if (!isPostgresUrl(value)) {
    return value;
  }

  const normalizedValue = forceDirectMode
    ? value
    : tryConvertSupabaseDirectToPooler(value);

  try {
    const parsed = new URL(normalizedValue);
    const host = parsed.hostname.toLowerCase();
    const isSupabaseHost =
      host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com");

    if (isSupabaseHost && !parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }

    if (
      host.endsWith(".pooler.supabase.com") &&
      !parsed.searchParams.has("pgbouncer")
    ) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    return parsed.toString();
  } catch (error) {
    return normalizedValue;
  }
};

const scoreDatabaseUrlCandidate = (key, value) => {
  let score = 0;
  const lowerValue = value.toLowerCase();

  if (connectionMode === "direct" && DIRECT_KEYS.has(key)) score += 200;
  if (connectionMode === "pooler" && POOLER_KEYS.has(key)) score += 200;

  if (key === "POSTGRES_PRISMA_URL") score += 60;
  if (key === "POSTGRES_URL") score += 40;
  if (key === "SUPABASE_DB_POOLER_URL" || key === "SUPABASE_POOLER_URL") score += 40;
  if (key === "SUPABASE_DB_URL" || key === "SUPABASE_DATABASE_URL") score += 30;
  if (key === "DATABASE_URL") score += 20;
  if (key === "DIRECT_URL" || key === "POSTGRES_URL_NON_POOLING") score -= 10;
  if (lowerValue.includes("pgbouncer=true")) score += 25;
  if (lowerValue.includes("pooler.")) score += 20;
  if (lowerValue.includes("sslmode=require")) score += 10;

  return score;
};

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

  return finalizePostgresUrl(
    `postgresql://${encodedUser}${encodedPassword}@${host}:${port}/${encodedDatabase}`,
  );
};

const candidateUrls = DATABASE_URL_KEYS.map((key) => ({
  key,
  value: finalizePostgresUrl(normalizeRawDatabaseValue(process.env[key])),
}))
  .filter((candidate) => isPostgresUrl(candidate.value))
  .sort(
    (a, b) =>
      scoreDatabaseUrlCandidate(b.key, b.value) -
      scoreDatabaseUrlCandidate(a.key, a.value),
  );

const databaseUrl = finalizePostgresUrl(
  candidateUrls[0]?.value || buildDatabaseUrlFromParts(),
);

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;

  if (process.env.NODE_ENV === "production" && isLikelySupabaseDirectUrl(databaseUrl)) {
    console.warn(
      "Using direct Supabase URL (db.<project-ref>.supabase.co:5432). If you see connectivity errors in serverless, set POSTGRES_PRISMA_URL to the Supabase pooler URL.",
    );
  }
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
