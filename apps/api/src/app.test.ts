import { healthResponseSchema } from "@repo/shared";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const app = createApp();

describe("GET /health", () => {
  it("returns ok with a valid body", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe("ok");
    expect(body.service).toBe("api");
  });

  it("is reachable through the typed client", async () => {
    const client = testClient(app, { CORS_ORIGINS: "*" });
    const res = await client.health.$get();

    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });
});

describe("CORS", () => {
  it("allows any origin by default", async () => {
    const res = await app.request("/health", { headers: { Origin: "http://localhost:8081" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:8081");
  });

  it("rejects origins outside CORS_ORIGINS", async () => {
    const res = await app.request(
      "/health",
      { headers: { Origin: "https://evil.example" } },
      { CORS_ORIGINS: "https://app.example.com" },
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows origins listed in CORS_ORIGINS", async () => {
    const res = await app.request(
      "/health",
      { headers: { Origin: "https://app.example.com" } },
      { CORS_ORIGINS: "https://app.example.com, https://other.example.com" },
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });
});

describe("unknown routes", () => {
  it("return a JSON 404", async () => {
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });
});
