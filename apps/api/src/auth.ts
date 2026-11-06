import { expo } from "@better-auth/expo";
import { PASSWORD_MIN_LENGTH, type SocialProvider } from "@repo/shared";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { ConfigError, isDevelopment, parseList } from "./config";
import type { Database } from "./db/client";
import { account, rateLimit, session, user, verification } from "./db/schema";
import type { Bindings } from "./env";

/** Better Auth is mounted here; the app's auth client uses the same default path. */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * Trusted origins used ONLY in local development (`ENVIRONMENT=development`) when
 * `TRUSTED_ORIGINS` is not set:
 * - the Expo web dev server;
 * - the app scheme from `apps/app/app.json` (`scheme`), used by dev and store builds;
 * - `exp://`, the scheme of Expo Go (any host).
 * Outside development `TRUSTED_ORIGINS` is required (real web URL and the app scheme).
 */
export const DEVELOPMENT_TRUSTED_ORIGINS = ["http://localhost:8081", "foremanapp://", "exp://"];

/**
 * Origins Better Auth trusts and that may send cookies. Fails closed: outside development,
 * an unset `TRUSTED_ORIGINS` is a configuration error, not a permissive default.
 */
export function trustedOrigins(env: Bindings): string[] {
  const list = parseList(env.TRUSTED_ORIGINS);
  if (list.length > 0) return list;
  if (isDevelopment(env)) return DEVELOPMENT_TRUSTED_ORIGINS;
  throw new ConfigError(
    "TRUSTED_ORIGINS is not set. List the web URL and the app scheme (comma-separated) in the Worker vars; defaults exist only with ENVIRONMENT=development.",
  );
}

/**
 * Public URL of the API (OAuth callbacks, cookie scope). Outside development it must be
 * configured: the request's own origin is client-controlled (Host header) and not trusted.
 */
export function authBaseURL(env: Bindings, requestUrl: string): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (isDevelopment(env)) return new URL(requestUrl).origin;
  throw new ConfigError(
    "BETTER_AUTH_URL is not set. Set the public URL of the API; it is derived from the request only with ENVIRONMENT=development.",
  );
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
  /** Public origin of the API, e.g. `https://api.example.com` (see `authBaseURL`). */
  baseURL: string;
};

/**
 * Better Auth for one request. Bindings only exist per request in Workers, so the
 * instance is built on demand (cheap: no I/O until a handler runs).
 */
export function createAuth({ db, env, baseURL }: CreateAuthOptions) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new ConfigError(
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
      schema: { user, session, account, verification, rateLimit },
      // Off (also the adapter's default): the Neon HTTP driver has no interactive
      // transactions. Operations run one by one. See "Banco" in CLAUDE.md.
      transaction: false,
    }),
    emailAndPassword: { enabled: true, minPasswordLength: PASSWORD_MIN_LENGTH },
    // Workers are stateless and short-lived, so counters live in Postgres (table `rate_limit`).
    // Better Auth only enables the limiter when NODE_ENV=production, which Workers don't set,
    // so it is switched on here for everything except local development.
    rateLimit: { enabled: !isDevelopment(env), storage: "database", window: 10, max: 100 },
    socialProviders: socialProviders(env),
    trustedOrigins: trustedOrigins(env),
    // Already the default in production; explicit so tests (NODE_ENV=test) check origins too.
    // The client IP (rate limit key, session metadata) comes from Cloudflare's header.
    advanced: {
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    // Native apps keep the session cookie in expo-secure-store and send it back as a header.
    plugins: [expo()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export type SessionUser = Auth["$Infer"]["Session"]["user"];
