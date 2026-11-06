import { createMiddleware } from "hono/factory";
import type { SessionUser } from "../auth";
import type { AppEnv } from "../env";

export type AuthedEnv = AppEnv & {
  Variables: AppEnv["Variables"] & { user: SessionUser };
};

/**
 * Rejects requests without a valid Better Auth session (401) and exposes the user as
 * `c.var.user`. Reads the session cookie, which the web app sends with
 * `credentials: "include"` and the native app sends as a `Cookie` header.
 */
export const requireUser = createMiddleware<AuthedEnv>(async (c, next) => {
  const result = await c.var.services.auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", result.user);
  await next();
});
