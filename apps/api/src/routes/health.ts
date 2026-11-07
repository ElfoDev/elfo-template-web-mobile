import type { DatabaseHealthResponse, HealthResponse } from "@repo/shared";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../env";

export const healthRoutes = new Hono<AppEnv>()
  // The Worker is up. Needs no configuration, so it also answers on a broken deploy.
  .get("/", (c) => {
    const body: HealthResponse = {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    };
    return c.json(body, 200);
  })
  // The Worker reaches the database (the deploy's smoke test). A missing DATABASE_URL or an
  // unreachable database answers 500 through `app.onError`.
  .get("/db", async (c) => {
    await c.var.services.db.execute(sql`select 1`);
    const body: DatabaseHealthResponse = { status: "ok", database: "ok" };
    return c.json(body, 200);
  });
