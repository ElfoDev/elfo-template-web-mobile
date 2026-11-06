import { expo } from "@better-auth/expo";
import type { SocialProvider } from "@repo/shared";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import type { Database } from "./db/client";
import { account, session, user, verification } from "./db/schema";
import type { Bindings } from "./env";

/** Better Auth is mounted here; the app's auth client uses the same default path. */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * Trusted origins when `TRUSTED_ORIGINS` is not set (local development):
 * - the Expo web dev server;
 * - the app scheme from `apps/app/app.json` (`scheme`), used by dev and store builds;
 * - `exp://`, the scheme of Expo Go (any host).
 * In production set `TRUSTED_ORIGINS` with the real web URL and the app scheme.
 */
export const DEFAULT_TRUSTED_ORIGINS = ["http://localhost:8081", "foremanapp://", "exp://"];

export function trustedOrigins(env: Bindings): string[] {
  const list = env.TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return list && list.length > 0 ? list : DEFAULT_TRUSTED_ORIGINS;
}

function socialProviders(env: Bindings) {
  return {
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
      : {}),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {}),
  };
}

/** OAuth providers enabled by the environment (both client id and secret set). */
export function enabledSocialProviders(env: Bindings): SocialProvider[] {
  const enabled: SocialProvider[] = [];
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) enabled.push("github");
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) enabled.push("google");
  return enabled;
}

type CreateAuthOptions = {
  db: Database;
  env: Bindings;
  /** Public origin of the API, e.g. `https://api.example.com`. */
  baseURL: string;
};

/**
 * Better Auth for one request. Bindings only exist per request in Workers, so the
 * instance is built on demand (cheap: no I/O until a handler runs).
 */
export function createAuth({ db, env, baseURL }: CreateAuthOptions) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Use `.dev.vars` locally or `wrangler secret put` in production.",
    );
  }

  return betterAuth({
    appName: "Foreman App",
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true },
    socialProviders: socialProviders(env),
    trustedOrigins: trustedOrigins(env),
    // Already the default in production; explicit so tests (NODE_ENV=test) check origins too.
    advanced: { disableOriginCheck: false },
    // Native apps keep the session cookie in expo-secure-store and send it back as a header.
    plugins: [expo()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export type SessionUser = Auth["$Infer"]["Session"]["user"];
