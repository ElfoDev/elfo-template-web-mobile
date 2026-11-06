import { existsSync, mkdirSync } from "node:fs";
import { createPgliteDb, type PgliteDb } from "../src/db/pglite";
import type { Bindings } from "../src/env";

/** Where the local dev server keeps its PGlite database (gitignored). */
export const LOCAL_DATA_DIR = "./.data/pglite";

/**
 * Used only by the local dev server when `.dev.vars` has no secret, so `pnpm dev` works
 * right after cloning. Never deploy with it: the Worker requires a real secret.
 */
const DEV_AUTH_SECRET = "dev-only-secret-change-me-dev-only-secret-change-me";

const BINDING_KEYS = [
  "CORS_ORIGINS",
  "TRUSTED_ORIGINS",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const satisfies readonly (keyof Bindings)[];

/** Loads `.dev.vars` (same file `wrangler dev` reads) into `process.env`, if present. */
export function loadDevVars(): void {
  if (existsSync(".dev.vars")) process.loadEnvFile(".dev.vars");
}

/** Worker bindings for the Node dev server, from `process.env` (after `loadDevVars`). */
export function localBindings(): Bindings {
  const env: Bindings = {};
  for (const key of BINDING_KEYS) {
    const value = process.env[key]?.trim();
    if (value) env[key] = value;
  }
  env.BETTER_AUTH_SECRET ??= DEV_AUTH_SECRET;
  return env;
}

/** Opens (creating if needed) the local PGlite database and applies pending migrations. */
export function openLocalDb(): Promise<PgliteDb> {
  mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  return createPgliteDb({ dataDir: LOCAL_DATA_DIR });
}
