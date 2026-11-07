import { databaseHealthResponseSchema, healthResponseSchema } from "@repo/shared";
import { testClient } from "hono/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp, isApiPath } from "./app";
import { createPgliteDb, type PgliteDb } from "./db/pglite";
import type { StaticAssets } from "./env";

const app = createApp();

describe("GET /api/health", () => {
  it("returns ok with a valid body", async () => {
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe("ok");
    expect(body.service).toBe("api");
  });

  it("is reachable through the typed client", async () => {
    const client = testClient(app, { ENVIRONMENT: "development" });
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });
});

describe("GET /api/health/db", () => {
  let pglite: PgliteDb;

  beforeAll(async () => {
    pglite = await createPgliteDb();
  });

  afterAll(async () => {
    await pglite.close();
  });

  it("answers ok when the database answers", async () => {
    const res = await createApp({ db: pglite.db }).request("/api/health/db");

    expect(res.status).toBe(200);
    expect(databaseHealthResponseSchema.parse(await res.json())).toEqual({
      status: "ok",
      database: "ok",
    });
  });

  it("answers 500 naming the missing DATABASE_URL", async () => {
    const res = await app.request("/api/health/db", {}, {});

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: expect.stringContaining("DATABASE_URL is not set") });
  });
});

describe("CORS", () => {
  it("allows any origin by default in development", async () => {
    const res = await app.request(
      "/api/health",
      { headers: { Origin: "http://localhost:8081" } },
      { ENVIRONMENT: "development" },
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:8081");
  });

  it("rejects origins outside CORS_ORIGINS", async () => {
    const res = await app.request(
      "/api/health",
      { headers: { Origin: "https://evil.example" } },
      { CORS_ORIGINS: "https://app.example.com" },
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows origins listed in CORS_ORIGINS", async () => {
    const res = await app.request(
      "/api/health",
      { headers: { Origin: "https://app.example.com" } },
      { CORS_ORIGINS: "https://app.example.com, https://other.example.com" },
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });
});

describe("unknown routes", () => {
  it("return a JSON 404 under /api", async () => {
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  it("return a JSON 404 elsewhere without the web app (tests, Node dev server)", async () => {
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });
});

describe("web app (static assets)", () => {
  const assets = {
    fetch: vi.fn<StaticAssets["fetch"]>(
      async () => new Response("not found page", { status: 404 }),
    ),
  };

  it("hands paths outside /api to the assets (their 404 page)", async () => {
    const res = await app.request("/no-such-page", {}, { ASSETS: assets });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("not found page");
    expect(assets.fetch).toHaveBeenCalledOnce();
    expect(assets.fetch.mock.calls[0]?.[0].url).toBe("http://localhost/no-such-page");
  });

  it("keeps API 404s as JSON", async () => {
    assets.fetch.mockClear();
    const res = await app.request("/api/no-such-route", {}, { ASSETS: assets });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("tells API paths from web paths", () => {
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/api/tasks")).toBe(true);
    expect(isApiPath("/apis")).toBe(false);
    expect(isApiPath("/tasks")).toBe(false);
  });
});
