import type { HealthResponse } from "@repo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../env";

export const healthRoutes = new Hono<AppEnv>().get("/", (c) => {
  const body: HealthResponse = {
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  };
  return c.json(body, 200);
});
