import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env";
import { healthRoutes } from "./routes/health";

function allowedOrigin(origin: string, list: string | undefined): string | null {
  const origins = (list ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.includes("*")) return origin || "*";
  return origins.includes(origin) ? origin : null;
}

const app = new Hono<AppEnv>()
  .use("*", (c, next) =>
    cors({ origin: (origin) => allowedOrigin(origin, c.env?.CORS_ORIGINS) })(c, next),
  )
  // Chain every route here so `AppType` carries the full route graph for the RPC client.
  .route("/health", healthRoutes);

app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export type AppType = typeof app;

export default app;
