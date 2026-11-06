import { PASSWORD_MIN_LENGTH } from "@repo/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { Database } from "./db/client";
import { createPgliteDb, type PgliteDb } from "./db/pglite";
import type { Bindings } from "./env";
import { cookieFrom } from "./test/helpers";

const WEB = "https://api.example.com";

/** What the deployed Worker has: no ENVIRONMENT, so every dev default is off. */
const PROD_ENV: Bindings = {
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-test-secret",
  BETTER_AUTH_URL: WEB,
  TRUSTED_ORIGINS: `${WEB},foremanapp://`,
};

let pglite: PgliteDb;

beforeAll(async () => {
  pglite = await createPgliteDb();
});

afterAll(async () => {
  await pglite.close();
});

/** POST from the web origin; `ip` is the client address (Cloudflare's header), a rate-limit key. */
function post(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  env: Bindings,
  ip = "203.0.113.7",
) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: WEB, "cf-connecting-ip": ip },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("fails closed outside development", () => {
  it("answers 500 naming TRUSTED_ORIGINS when it is missing", async () => {
    const app = createApp({ db: pglite.db });
    const { TRUSTED_ORIGINS: _, ...env } = PROD_ENV;

    for (const path of ["/api/auth/get-session", "/tasks"]) {
      const res = await app.request(path, { headers: { origin: "http://localhost:8081" } }, env);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: expect.stringContaining("TRUSTED_ORIGINS is not set"),
      });
    }
  });

  it("answers 500 naming BETTER_AUTH_URL when it is missing", async () => {
    const app = createApp({ db: pglite.db });
    const { BETTER_AUTH_URL: _, ...env } = PROD_ENV;

    const res = await app.request("/api/auth/get-session", {}, env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: expect.stringContaining("BETTER_AUTH_URL is not set"),
    });
  });

  it("does not trust the dev origins or derive the URL from the request", async () => {
    const app = createApp({ db: pglite.db });
    const dev = await app.request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8081" },
        body: JSON.stringify({ email: "x@example.com", password: "whatever-password" }),
      },
      PROD_ENV,
    );
    expect(dev.status).toBe(403);
  });

  it("keeps routes that need no auth or database working", async () => {
    const res = await createApp().request("/health", {}, {});
    expect(res.status).toBe(200);
  });

  it("allows no cross-origin browser access without an explicit CORS_ORIGINS", async () => {
    const app = createApp({ db: pglite.db });
    for (const CORS_ORIGINS of [undefined, "*"]) {
      const res = await app.request(
        "/health",
        { headers: { origin: "https://evil.example" } },
        { ...PROD_ENV, CORS_ORIGINS },
      );
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    }
  });

  it("allows the listed origin, with credentials only if it is trusted", async () => {
    const app = createApp({ db: pglite.db });
    const env = { ...PROD_ENV, CORS_ORIGINS: `${WEB},https://other.example` };

    const trusted = await app.request("/health", { headers: { origin: WEB } }, env);
    expect(trusted.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(trusted.headers.get("access-control-allow-credentials")).toBe("true");

    const other = await app.request(
      "/health",
      { headers: { origin: "https://other.example" } },
      env,
    );
    expect(other.headers.get("access-control-allow-origin")).toBe("https://other.example");
    expect(other.headers.get("access-control-allow-credentials")).toBeNull();
  });
});

describe("password policy", () => {
  it(`rejects passwords under ${PASSWORD_MIN_LENGTH} characters`, async () => {
    const app = createApp({ db: pglite.db });
    const res = await post(
      app,
      "/api/auth/sign-up/email",
      { name: "Short", email: "short@example.com", password: "a".repeat(PASSWORD_MIN_LENGTH - 1) },
      PROD_ENV,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "PASSWORD_TOO_SHORT" });
  });
});

describe("rate limit (database storage)", () => {
  it("is on outside development and persists counters in rate_limit", async () => {
    const app = createApp({ db: pglite.db });
    const body = { email: "nobody@example.com", password: "wrong-password-123" };

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await post(app, "/api/auth/sign-in/email", body, PROD_ENV)).status);
    }
    expect(statuses[0]).toBe(401);
    expect(statuses).toContain(429);

    const rows = await pglite.client.query<{ n: number }>(
      "select count(*)::int as n from rate_limit",
    );
    expect(rows.rows[0]?.n).toBeGreaterThan(0);
  });

  it("is off in development", async () => {
    const app = createApp({ db: pglite.db });
    const env = { ...PROD_ENV, ENVIRONMENT: "development" };
    const body = { email: "nobody@example.com", password: "wrong-password-123" };

    for (let i = 0; i < 6; i++) {
      expect((await post(app, "/api/auth/sign-in/email", body, env)).status).toBe(401);
    }
  });
});

describe("no database transactions", () => {
  it("sign-up, sign-in and sign-out never call db.transaction (Neon HTTP has none)", async () => {
    const calls: string[] = [];
    const db = new Proxy(pglite.db, {
      get(target, prop, receiver) {
        if (prop === "transaction") {
          return () => {
            calls.push("transaction");
            throw new Error("transactions are not supported by neon-http");
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as Database;
    const app = createApp({ db });
    const credentials = { email: "tx@example.com", password: "correct-horse-battery" };

    const signUp = await post(
      app,
      "/api/auth/sign-up/email",
      { name: "Tx", ...credentials },
      PROD_ENV,
    );
    expect(signUp.status).toBe(200);
    const signIn = await post(app, "/api/auth/sign-in/email", credentials, PROD_ENV, "203.0.113.9");
    expect(signIn.status).toBe(200);
    const signOut = await app.request(
      "/api/auth/sign-out",
      { method: "POST", headers: { origin: WEB, cookie: cookieFrom(signIn) } },
      PROD_ENV,
    );
    expect(signOut.status).toBe(200);

    expect(calls).toEqual([]);
  });
});
