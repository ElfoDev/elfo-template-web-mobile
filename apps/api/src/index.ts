import { createApp } from "./app";

export type { AppType } from "./app";

/**
 * Worker entry: the API under `/api` (Neon from `DATABASE_URL`) and, at every other path, the
 * web app from the `ASSETS` binding. See `wrangler.jsonc` and `.dev.vars.example`.
 */
export default createApp();
