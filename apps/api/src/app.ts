import { Hono } from "hono";
import { cors } from "hono/cors";
import { AUTH_BASE_PATH, DEVELOPMENT_TRUSTED_ORIGINS } from "./auth";
import { ConfigError, isDevelopment, parseList } from "./config";
import type { Database } from "./db/client";
import type { AppEnv, Bindings } from "./env";
import { authProviderRoutes } from "./routes/auth-providers";
import { healthRoutes } from "./routes/health";
import { taskRoutes } from "./routes/tasks";
import { createServices } from "./services";

/**
 * Browser origins CORS lets through. Production needs an explicit `CORS_ORIGINS` list (this
 * API sends credentials); unset allows no cross-origin access. "*" only works in development.
 */
function allowedOrigin(origin: string, env: Bindings): string | null {
  const dev = isDevelopment(env);
  const origins = env.CORS_ORIGINS === undefined && dev ? ["*"] : parseList(env.CORS_ORIGINS);
  if (dev && origins.includes("*")) return origin || "*";
  return origins.includes(origin) ? origin : null;
}

/**
 * Browsers may send cookies (the web session) only from trusted http(s) origins, even in
 * development with `CORS_ORIGINS=*`: any origin can call public routes, but not act as the user.
 * Without a configured trusted list (misconfiguration, reported by the auth routes) nothing is.
 */
function allowsCredentials(origin: string | undefined, env: Bindings): boolean {
  if (!origin) return false;
  const trusted = parseList(env.TRUSTED_ORIGINS);
  const list = trusted.length > 0 || !isDevelopment(env) ? trusted : DEVELOPMENT_TRUSTED_ORIGINS;
  return list.some((entry) => /^https?:\/\//.test(entry) && entry === origin);
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
        origin: (origin) => allowedOrigin(origin, env),
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
    // Configuration errors name the missing setting (never a value): the deploy is broken,
    // so say so instead of serving with insecure defaults or a vague message.
    if (err instanceof ConfigError) return c.json({ error: err.message }, 500);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;
