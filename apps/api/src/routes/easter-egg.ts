import type { EasterEggResponse } from "@repo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../env";

/** The backend's half of the preview Easter Egg. The home screen shows this message. */
export const EASTER_EGG_MESSAGE = "🥚 Você encontrou o Easter Egg do backend";

export const easterEggRoutes = new Hono<AppEnv>()
  // Public and database-free: answers as long as the Worker is up.
  .get("/", (c) => {
    const body: EasterEggResponse = {
      message: EASTER_EGG_MESSAGE,
      timestamp: new Date().toISOString(),
    };
    return c.json(body, 200);
  });
