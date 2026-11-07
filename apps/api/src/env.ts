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
   * The web app (Expo web export of `apps/app`), bundled as the Worker's static assets
   * (`assets` in `wrangler.jsonc`). Requests outside `/api` that match no file land here.
   * Absent in tests and in the local Node dev server.
   */
  ASSETS?: StaticAssets;
  /**
   * Comma-separated list of browser origins allowed by CORS. Must be an explicit list in
   * production (credentials are involved); unset means no cross-origin access there.
   * "*" is accepted in development only.
   */
  CORS_ORIGINS?: string;
  /**
   * Extra comma-separated origins Better Auth trusts (CSRF checks, redirects) and that may send
   * cookies to the API from another browser origin. Outside development the API's own origin
   * and the app scheme are always trusted (see `trustedOrigins` in `auth.ts`), so this is only
   * needed for a web app on another origin. In development it defaults to
   * `DEVELOPMENT_TRUSTED_ORIGINS`.
   */
  TRUSTED_ORIGINS?: string;
  /** Neon connection string. Required in the Worker; the local dev server falls back to PGlite. */
  DATABASE_URL?: string;
  /** Secret used to sign cookies and tokens (secret, at least 32 chars). */
  BETTER_AUTH_SECRET?: string;
  /**
   * Public URL of the API (OAuth callbacks). Optional: by default it is the origin the request
   * came in on (the workers.dev URL or a custom domain). Set it to pin one URL.
   */
  BETTER_AUTH_URL?: string;
  /** OAuth (optional): a provider is enabled only when both its id and secret are set. */
  OAUTH_GITHUB_CLIENT_ID?: string;
  OAUTH_GITHUB_CLIENT_SECRET?: string;
  OAUTH_GOOGLE_CLIENT_ID?: string;
  OAUTH_GOOGLE_CLIENT_SECRET?: string;
};

/** The `ASSETS` binding (a Workers `Fetcher`), typed without the Worker globals. */
export type StaticAssets = {
  fetch(request: Request): Promise<Response>;
};

export type Variables = {
  /** Database and auth for this request, created lazily (see `services.ts`). */
  services: Services;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
