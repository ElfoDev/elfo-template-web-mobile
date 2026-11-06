import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { LOCAL_DATA_DIR } from "./scripts/local-env";

if (existsSync(".dev.vars")) process.loadEnvFile(".dev.vars");

const databaseUrl = process.env.DATABASE_URL;

/**
 * `pnpm db:generate` only reads the schema (no database needed).
 * `drizzle-kit studio` uses Neon when `DATABASE_URL` is set, otherwise the local PGlite.
 * Migrations are applied by `pnpm db:migrate` (`scripts/migrate.ts`).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  ...(databaseUrl
    ? { dbCredentials: { url: databaseUrl } }
    : { driver: "pglite", dbCredentials: { url: LOCAL_DATA_DIR } }),
});
