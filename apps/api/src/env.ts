/**
 * Worker bindings (vars, secrets, resources) declared in `wrangler.jsonc`.
 *
 * Keep this file free of ambient Worker globals: `packages/shared` and the app import
 * the API types (type-only) to build the RPC client, outside the Worker type environment.
 */
export type Bindings = {
  /** Comma-separated list of allowed browser origins, or "*". */
  CORS_ORIGINS?: string;
};

export type AppEnv = {
  Bindings: Bindings;
};
