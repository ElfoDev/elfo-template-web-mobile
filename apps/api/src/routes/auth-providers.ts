import type { AuthProvidersResponse } from "@repo/shared";
import { Hono } from "hono";
import { enabledSocialProviders } from "../auth";
import type { AppEnv } from "../env";

/** Which sign-in methods the app should offer (OAuth buttons only for configured providers). */
export const authProviderRoutes = new Hono<AppEnv>().get("/", (c) => {
  const body: AuthProvidersResponse = {
    emailAndPassword: true,
    social: enabledSocialProviders(c.env ?? {}),
  };
  return c.json(body, 200);
});
