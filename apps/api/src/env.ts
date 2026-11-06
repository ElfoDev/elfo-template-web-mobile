import type { Services } from "./services";

/**
 * Worker bindings (vars, secrets, resources). Non-secret vars live in `wrangler.jsonc`;
 * secrets in `.dev.vars` locally and `wrangler secret put` in production.
 *
 * Keep this file free of ambient Worker globals: `packages/shared` and the app import
 * the API types (type-only) to build the RPC client, outside the Worker type environment.
 */
export type Bindings = {
  /**
   * Set to "development" only for local development (`.dev.vars`, `pnpm dev:api`). Anything
   * else (including unset, as in production) fails closed: no default origins, no `baseURL`
   * derived from the request, rate limiting on. Never set it in `wrangler.jsonc`.
   */
  ENVIRONMENT?: string;
  /**
   * Comma-separated list of browser origins allowed by CORS. Must be an explicit list in
   * production (credentials are involved); unset means no cross-origin access there.
   * "*" is accepted in development only.
   */
  CORS_ORIGINS?: string;
  /**
   * Comma-separated origins Better Auth trusts (CSRF checks, redirects) and that may send
   * cookies to the API from a browser. Required outside development; in development it
   * defaults to `DEVELOPMENT_TRUSTED_ORIGINS` in `auth.ts`.
   */
  TRUSTED_ORIGINS?: string;
  /** Neon connection string. Required in the Worker; the local dev server falls back to PGlite. */
  DATABASE_URL?: string;
  /** Secret used to sign cookies and tokens (secret, at least 32 chars). */
  BETTER_AUTH_SECRET?: string;
  /**
   * Public URL of the API. Required outside development; in development it defaults to the
   * origin of the incoming request.
   */
  BETTER_AUTH_URL?: string;
  /** OAuth (optional): a provider is enabled only when both its id and secret are set. */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export type Variables = {
  /** Database and auth for this request, created lazily (see `services.ts`). */
  services: Services;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
