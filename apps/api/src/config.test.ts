import { PASSWORD_MIN_LENGTH } from "@repo/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { authBaseURL, trustedOrigins } from "./auth";
import type { Database } from "./db/client";
import { createPgliteDb, type PgliteDb } from "./db/pglite";
import type { Bindings } from "./env";
import { cookieFrom } from "./test/helpers";

/** The deployed Worker's own URL: it serves the web app and the API on one origin. */
const WEB = "https://my-app.example.workers.dev";

/**
 * What the deploy gives the Worker: secrets only. No ENVIRONMENT (every dev default is off),
 * no BETTER_AUTH_URL or TRUSTED_ORIGINS (the API's own origin comes from the request).
 */
const PROD_ENV: Bindings = {
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-test-secret",
};

let pglite: PgliteDb;

beforeAll(async () => {
  pglite = await createPgliteDb();
});

afterAll(async () => {
  await pglite.close();
});

/** POST to the deployed URL; `ip` is the client address (Cloudflare's header), a rate-limit key. */
function post(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  env: Bindings,
  ip = "203.0.113.7",
  headers: Record<string, string> = { origin: WEB },
) {
  return app.request(
    `${WEB}${path}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...headers },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("origins outside development", () => {
  it("serves auth on the request's own origin with no URL configured", async () => {
    const app = createApp({ db: pglite.db });
    const res = await post(
      app,
      "/api/auth/sign-up/email",
      { name: "Web", email: "web@example.com", password: "correct-horse-battery" },
      PROD_ENV,
    );
    expect(res.status).toBe(200);
    // https origin: Better Auth sets secure cookies.
    expect(cookieFrom(res)).toContain("__Secure-better-auth.session_token=");
  });

  it("trusts the app scheme (dev and store builds)", async () => {
    const app = createApp({ db: pglite.db });
    const res = await post(
      app,
      "/api/auth/sign-up/email",
      { name: "Native", email: "native@example.com", password: "correct-horse-battery" },
      PROD_ENV,
      "203.0.113.8",
      { "expo-origin": "foremanapp://" },
    );
    expect(res.status).toBe(200);
  });

  it("trusts no other site, the dev web server or Expo Go", async () => {
    const app = createApp({ db: pglite.db });
    const body = { email: "web@example.com", password: "correct-horse-battery" };
    const untrusted: Record<string, string>[] = [
      { origin: "https://evil.example" },
      { origin: "http://localhost:8081" },
      { "expo-origin": "exp://192.168.0.10:8081" },
    ];
    for (const headers of untrusted) {
      const res = await post(
        app,
        "/api/auth/sign-in/email",
        body,
        PROD_ENV,
        "203.0.113.10",
        headers,
      );
      expect(res.status).toBe(403);
    }
  });

  it("trusts the extra origins in TRUSTED_ORIGINS", async () => {
    const app = createApp({ db: pglite.db });
    const env = { ...PROD_ENV, TRUSTED_ORIGINS: "https://web.example.com" };
    const res = await post(
      app,
      "/api/auth/sign-in/email",
      { email: "web@example.com", password: "correct-horse-battery" },
      env,
      "203.0.113.11",
      { origin: "https://web.example.com" },
    );
    expect(res.status).toBe(200);
  });

  it("still fails closed without BETTER_AUTH_SECRET", async () => {
    const app = createApp({ db: pglite.db });
    const res = await app.request(`${WEB}/api/auth/get-session`, {}, {});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: expect.stringContaining("BETTER_AUTH_SECRET is not set"),
    });
  });

  it("keeps routes that need no auth or database working", async () => {
    const res = await createApp().request("/api/health", {}, {});
    expect(res.status).toBe(200);
  });

  it("allows no cross-origin browser access without an explicit CORS_ORIGINS", async () => {
    const app = createApp({ db: pglite.db });
    for (const CORS_ORIGINS of [undefined, "*"]) {
      const res = await app.request(
        "/api/health",
        { headers: { origin: "https://evil.example" } },
        { ...PROD_ENV, CORS_ORIGINS },
      );
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    }
  });

  it("allows the listed origin, with credentials only if it is trusted", async () => {
    const app = createApp({ db: pglite.db });
    const OTHER_WEB = "https://web.example.com";
    const env = {
      ...PROD_ENV,
      TRUSTED_ORIGINS: OTHER_WEB,
      CORS_ORIGINS: `${OTHER_WEB},https://other.example`,
    };

    const trusted = await app.request("/api/health", { headers: { origin: OTHER_WEB } }, env);
    expect(trusted.headers.get("access-control-allow-origin")).toBe(OTHER_WEB);
    expect(trusted.headers.get("access-control-allow-credentials")).toBe("true");

    const other = await app.request(
      "/api/health",
      { headers: { origin: "https://other.example" } },
      env,
    );
    expect(other.headers.get("access-control-allow-origin")).toBe("https://other.example");
    expect(other.headers.get("access-control-allow-credentials")).toBeNull();
  });
});

describe("authBaseURL", () => {
  it("is the request's origin by default, in every environment", () => {
    expect(authBaseURL({}, `${WEB}/api/auth/session`)).toBe(WEB);
    expect(authBaseURL({ ENVIRONMENT: "development" }, "http://localhost:8787/api/x")).toBe(
      "http://localhost:8787",
    );
  });

  it("is BETTER_AUTH_URL when set", () => {
    expect(authBaseURL({ BETTER_AUTH_URL: "https://app.example.com" }, `${WEB}/api/x`)).toBe(
      "https://app.example.com",
    );
  });
});

describe("trustedOrigins", () => {
  it("outside development: own origins, the app scheme and TRUSTED_ORIGINS", () => {
    expect(trustedOrigins({}, `${WEB}/api/x`, WEB)).toEqual([WEB, "foremanapp://"]);
    expect(
      trustedOrigins(
        { TRUSTED_ORIGINS: "https://web.example.com" },
        `${WEB}/api/x`,
        "https://app.example.com",
      ),
    ).toEqual([WEB, "https://app.example.com", "foremanapp://", "https://web.example.com"]);
  });

  it("in development: own origin plus the dev defaults, or TRUSTED_ORIGINS instead", () => {
    const local = "http://localhost:8787";
    expect(trustedOrigins({ ENVIRONMENT: "development" }, `${local}/x`, local)).toEqual([
      local,
      "http://localhost:8081",
      "foremanapp://",
      "exp://",
    ]);
    expect(
      trustedOrigins(
        { ENVIRONMENT: "development", TRUSTED_ORIGINS: "http://192.168.0.10:8081" },
        `${local}/x`,
        local,
      ),
    ).toEqual([local, "http://192.168.0.10:8081"]);
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
      `${WEB}/api/auth/sign-out`,
      { method: "POST", headers: { origin: WEB, cookie: cookieFrom(signIn) } },
      PROD_ENV,
    );
    expect(signOut.status).toBe(200);

    expect(calls).toEqual([]);
  });
});
