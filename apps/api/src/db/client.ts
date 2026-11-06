import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Schema = typeof schema;

/**
 * Any Postgres Drizzle database with our schema: Neon (HTTP) in the Worker,
 * PGlite in tests and in the local dev server.
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

/**
 * Neon over HTTP: one `fetch` per query, no connection to keep, which suits Workers.
 * It does not support interactive transactions (`db.transaction`); use `db.batch` if needed.
 */
export function createNeonDb(databaseUrl: string): Database {
  return drizzle({ client: neon(databaseUrl), schema });
}
