import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// pg-connection-string maps sslmode=require to certificate verification.
// The Supabase pooler certificate chain is not trusted by the Vercel Node
// runtime in this deployment. Remove the URL flag so it cannot override the
// explicit TLS options below. TLS remains enabled in production.
const connectionUrl = new URL(databaseUrl);
connectionUrl.searchParams.delete("sslmode");

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: connectionUrl.toString(),
    ...(process.env.NODE_ENV === "production"
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
