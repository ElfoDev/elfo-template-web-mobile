/**
 * `pnpm db:migrate`: applies the migrations in `drizzle/` to Neon when `DATABASE_URL` is set
 * (environment or `.dev.vars`), otherwise to the local PGlite in `.data/pglite`.
 * Stop `pnpm dev:api` first when migrating PGlite (one process at a time).
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { MIGRATIONS_FOLDER } from "../src/db/pglite";
import { LOCAL_DATA_DIR, loadDevVars, openLocalDb } from "./local-env";

loadDevVars();
const databaseUrl = process.env.DATABASE_URL?.trim();

if (databaseUrl) {
  await migrate(drizzle({ client: neon(databaseUrl) }), { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("Migrations applied to Neon (DATABASE_URL).");
} else {
  const local = await openLocalDb();
  await local.close();
  console.log(`Migrations applied to PGlite (${LOCAL_DATA_DIR}).`);
}
