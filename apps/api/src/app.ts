import { Hono } from "hono";
import { cors } from "hono/cors";
import { AUTH_BASE_PATH, trustedOrigins } from "./auth";
import type { Database } from "./db/client";
import type { AppEnv, Bindings } from "./env";
import { authProviderRoutes } from "./routes/auth-providers";
import { healthRoutes } from "./routes/health";
import { taskRoutes } from "./routes/tasks";
import { createServices } from "./services";

function allowedOrigin(origin: string, list: string | undefined): string | null {
  const origins = (list ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.includes("*")) return origin || "*";
  return origins.includes(origin) ? origin : null;
}

/**
 * Browsers may send cookies (the web session) only from trusted http(s) origins, even when
 * `CORS_ORIGINS` is "*": any origin can call public routes, but not act as the user.
 */
function allowsCredentials(origin: string | undefined, env: Bindings): boolean {
  if (!origin) return false;
  return trustedOrigins(env).some((trusted) => /^https?:\/\//.test(trusted) && trusted === origin);
}

export type AppOptions = {
  /**
   * Database used instead of Neon (`DATABASE_URL`). Tests and the local dev server pass
   * PGlite here; the Worker leaves it empty.
   */
  db?: Database;
};

export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppEnv>()
    .use("*", (c, next) => {
      const env = c.env ?? {};
      return cors({
        origin: (origin) => allowedOrigin(origin, env.CORS_ORIGINS),
        credentials: allowsCredentials(c.req.header("origin"), env),
      })(c, next);
    })
    .use("*", async (c, next) => {
      c.set("services", createServices(c.env ?? {}, c.req.url, options.db));
      await next();
    })
    // Better Auth: sign-up, sign-in, sign-out, session, OAuth callbacks...
    .on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, (c) => c.var.services.auth.handler(c.req.raw))
    // Chain every route here so `AppType` carries the full route graph for the RPC client.
    .route("/health", healthRoutes)
    .route("/auth/providers", authProviderRoutes)
    .route("/tasks", taskRoutes);

  app.notFound((c) => c.json({ error: "Not Found" }, 404));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;
