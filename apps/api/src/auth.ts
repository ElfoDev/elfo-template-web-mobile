import { expo } from "@better-auth/expo";
import { PASSWORD_MIN_LENGTH, type SocialProvider } from "@repo/shared";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { ConfigError, isDevelopment, parseList } from "./config";
import type { Database } from "./db/client";
import { account, rateLimit, session, user, verification } from "./db/schema";
import type { Bindings } from "./env";

/** Every API route lives under this path; the rest of the origin is the web app. */
export const API_BASE_PATH = "/api";

/** Better Auth is mounted here; the app's auth client uses the same default path. */
export const AUTH_BASE_PATH = `${API_BASE_PATH}/auth`;

/**
 * The app's own scheme (`scheme` in `apps/app/app.json`): development and store builds sign in
 * from it. Always trusted: only this app can receive its deep links.
 */
export const APP_SCHEME_ORIGIN = "foremanapp://";

/**
 * Trusted origins used ONLY in local development (`ENVIRONMENT=development`) when
 * `TRUSTED_ORIGINS` is not set:
 * - the Expo web dev server;
 * - the app scheme, used by dev and store builds;
 * - `exp://`, the scheme of Expo Go (any host). Never trusted outside development: Better Auth
 *   sends the session to the deep link after OAuth, and `exp://<any host>` is not ours.
 */
export const DEVELOPMENT_TRUSTED_ORIGINS = ["http://localhost:8081", APP_SCHEME_ORIGIN, "exp://"];

/**
 * Public URL of the API (OAuth callbacks, secure cookies): `BETTER_AUTH_URL` when set,
 * otherwise the origin the request came in on, so a fresh deploy works on its workers.dev URL
 * and on a custom domain with no configuration.
 *
 * Taking it from the request is safe on Workers: Cloudflare only routes hostnames bound to this
 * Worker (its workers.dev URL, custom domains, routes) to it, so the Host is never arbitrary.
 * Any other hosting must set `BETTER_AUTH_URL`.
 */
export function authBaseURL(env: Bindings, requestUrl: string): string {
  return env.BETTER_AUTH_URL?.trim() || new URL(requestUrl).origin;
}

/**
 * Origins Better Auth trusts (CSRF checks, redirect targets) and that may send cookies.
 *
 * Always the API's own origin (the request's and `baseURL`'s): the web app is served from it,
 * and trusting your own origin lets no other site in. Outside development, also the app scheme
 * and `TRUSTED_ORIGINS` (extra origins, e.g. a web app hosted elsewhere); never the local dev
 * defaults (localhost, Expo Go).
 */
export function trustedOrigins(env: Bindings, requestUrl: string, baseURL: string): string[] {
  const own = [new URL(requestUrl).origin, new URL(baseURL).origin];
  const configured = parseList(env.TRUSTED_ORIGINS);
  if (isDevelopment(env)) {
    return unique([...own, ...(configured.length > 0 ? configured : DEVELOPMENT_TRUSTED_ORIGINS)]);
  }
  return unique([...own, APP_SCHEME_ORIGIN, ...configured]);
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function socialProviders(env: Bindings) {
  return {
    ...(env.OAUTH_GITHUB_CLIENT_ID && env.OAUTH_GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.OAUTH_GITHUB_CLIENT_ID,
            clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.OAUTH_GOOGLE_CLIENT_ID && env.OAUTH_GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.OAUTH_GOOGLE_CLIENT_ID,
            clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  };
}

/** OAuth providers enabled by the environment (both client id and secret set). */
export function enabledSocialProviders(env: Bindings): SocialProvider[] {
  const enabled: SocialProvider[] = [];
  if (env.OAUTH_GITHUB_CLIENT_ID && env.OAUTH_GITHUB_CLIENT_SECRET) enabled.push("github");
  if (env.OAUTH_GOOGLE_CLIENT_ID && env.OAUTH_GOOGLE_CLIENT_SECRET) enabled.push("google");
  return enabled;
}

type CreateAuthOptions = {
  db: Database;
  env: Bindings;
  /** URL of the request being handled (its origin is trusted, see `trustedOrigins`). */
  requestUrl: string;
};

/**
 * Better Auth for one request. Bindings only exist per request in Workers, so the
 * instance is built on demand (cheap: no I/O until a handler runs).
 */
export function createAuth({ db, env, requestUrl }: CreateAuthOptions) {
  const baseURL = authBaseURL(env, requestUrl);
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new ConfigError(
      "BETTER_AUTH_SECRET is not set. Use `.dev.vars` locally or `wrangler secret put` in production.",
    );
  }

  return betterAuth({
    appName: "Elfo App",
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
    trustedOrigins: trustedOrigins(env, requestUrl, baseURL),
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
