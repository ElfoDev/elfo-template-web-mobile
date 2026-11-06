import { createApp } from "./app";

export type { AppType } from "./app";

/** Worker entry: Neon from `DATABASE_URL` (see `wrangler.jsonc` and `.dev.vars.example`). */
export default createApp();
