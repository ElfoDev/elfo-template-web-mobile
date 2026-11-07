import { easterEggResponseSchema } from "@repo/shared";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { EASTER_EGG_MESSAGE } from "./easter-egg";

const app = createApp();

describe("GET /api/easter-egg", () => {
  it("returns the backend Easter Egg, valid for the shared schema", async () => {
    const res = await app.request("/api/easter-egg");

    expect(res.status).toBe(200);
    const body = easterEggResponseSchema.parse(await res.json());
    expect(body.message).toBe(EASTER_EGG_MESSAGE);
  });

  it("is public and needs no database (no env at all)", async () => {
    const res = await app.request("/api/easter-egg", {}, {});

    expect(res.status).toBe(200);
  });

  it("is reachable through the typed client", async () => {
    const client = testClient(app, { ENVIRONMENT: "development" });
    const res = await client.api["easter-egg"].$get();

    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(EASTER_EGG_MESSAGE);
  });

  it("does not answer other methods", async () => {
    const res = await app.request("/api/easter-egg", { method: "POST" });

    expect(res.status).toBe(404);
  });
});
