/**
 * Local API server (`pnpm dev:api`): the same Hono app as the Worker, on Node.
 *
 * - Without `DATABASE_URL`: PGlite persisted in `.data/pglite`, migrated on start.
 *   No account or Docker needed.
 * - With `DATABASE_URL` in `.dev.vars`: Neon, like production (run `pnpm db:migrate` first).
 *
 * To run inside the real Workers runtime (needs Neon), use `pnpm --filter @repo/api dev:worker`.
 */
import { serve } from "@hono/node-server";
import { createApp } from "../src/app";
import type { PgliteDb } from "../src/db/pglite";
import { LOCAL_DATA_DIR, loadDevVars, localBindings, openLocalDb } from "./local-env";

const PORT = Number(process.env.PORT ?? 8787);

loadDevVars();
const env = localBindings();

let local: PgliteDb | undefined;
if (!env.DATABASE_URL) {
  local = await openLocalDb();
}

const app = createApp({ db: local?.db });

const server = serve(
  { fetch: (req) => app.fetch(req, env), port: PORT, hostname: "0.0.0.0" },
  () => {
    const database = local ? `PGlite (${LOCAL_DATA_DIR})` : "Neon (DATABASE_URL)";
    console.log(`API on http://localhost:${PORT} · database: ${database}`);
  },
);

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close();
  await local?.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
