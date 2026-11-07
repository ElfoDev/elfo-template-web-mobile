import { type Auth, createAuth } from "./auth";
import { ConfigError } from "./config";
import { createNeonDb, type Database } from "./db/client";
import type { Bindings } from "./env";

export type Services = {
  readonly db: Database;
  readonly auth: Auth;
};

/**
 * Per-request services, created on first use: routes that never touch the database
 * (e.g. `/api/health`) work without `DATABASE_URL` or `BETTER_AUTH_SECRET`.
 *
 * @param db Database to use instead of Neon (tests and the local dev server inject PGlite).
 */
export function createServices(env: Bindings, requestUrl: string, db?: Database): Services {
  let database = db;
  let auth: Auth | undefined;

  const getDb = (): Database => {
    if (!database) {
      if (!env.DATABASE_URL) {
        throw new ConfigError(
          "DATABASE_URL is not set. Locally `pnpm dev:api` uses PGlite; in the Worker set the Neon URL.",
        );
      }
      database = createNeonDb(env.DATABASE_URL);
    }
    return database;
  };

  return {
    get db() {
      return getDb();
    },
    get auth() {
      auth ??= createAuth({ db: getDb(), env, requestUrl });
      return auth;
    },
  };
}
