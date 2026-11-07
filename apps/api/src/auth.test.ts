import { authProvidersResponseSchema } from "@repo/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { cookieFrom, createTestApi, TEST_ENV, type TestApi, WEB_ORIGIN } from "./test/helpers";

let api: TestApi;

beforeAll(async () => {
  api = await createTestApi();
});

afterAll(async () => {
  await api.close();
});

describe("Better Auth (email + password)", () => {
  it("signs up, reads the session and signs out", async () => {
    const cookie = await api.signUp("ana@example.com", "Ana");
    expect(cookie).toContain("better-auth.session_token=");

    const session = await api.request("/api/auth/get-session", { cookie });
    expect(session.status).toBe(200);
    const body = (await session.json()) as { user: { email: string; name: string } };
    expect(body.user).toMatchObject({ email: "ana@example.com", name: "Ana" });

    const signOut = await api.request("/api/auth/sign-out", { method: "POST", cookie });
    expect(signOut.status).toBe(200);

    const after = await api.request("/api/auth/get-session", { cookie });
    expect(await after.json()).toBeNull();
  });

  it("signs in with the right password only", async () => {
    await api.signUp("bia@example.com");

    const wrong = await api.request("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "bia@example.com", password: "wrong-password" }),
    });
    expect(wrong.status).toBe(401);

    const right = await api.request("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "bia@example.com", password: "correct-horse-battery" }),
    });
    expect(right.status).toBe(200);
    expect(cookieFrom(right)).toContain("better-auth.session_token=");
  });

  it("rejects a duplicate email", async () => {
    await api.signUp("caio@example.com");
    const res = await api.request("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        name: "Caio",
        email: "caio@example.com",
        password: "another-password",
      }),
    });
    expect(res.status).toBe(422);
  });

  it("rejects requests from untrusted origins", async () => {
    const res = await api.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { origin: "https://evil.example" },
      body: JSON.stringify({ email: "bia@example.com", password: "correct-horse-battery" }),
    });
    expect(res.status).toBe(403);
  });

  it("accepts the native app through the expo-origin header", async () => {
    const res = await api.app.request(
      "/api/auth/sign-up/email",
      {
        method: "POST",
        headers: { "content-type": "application/json", "expo-origin": "exp://192.168.0.10:8081" },
        body: JSON.stringify({
          name: "Dani",
          email: "dani@example.com",
          password: "long-password",
        }),
      },
      api.env,
    );
    expect(res.status).toBe(200);
  });
});

describe("CORS with credentials", () => {
  it("lets trusted web origins send cookies", async () => {
    const res = await api.request("/api/health", { headers: { origin: WEB_ORIGIN } });
    expect(res.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("does not let other origins send cookies, even with CORS_ORIGINS=*", async () => {
    const res = await api.request("/api/health", { headers: { origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });
});

describe("GET /api/auth/providers", () => {
  const app = createApp();

  it("lists no OAuth provider by default", async () => {
    const res = await app.request("/api/auth/providers", {}, TEST_ENV);
    expect(authProvidersResponseSchema.parse(await res.json())).toEqual({
      emailAndPassword: true,
      social: [],
    });
  });

  it("enables a provider only when both id and secret are set", async () => {
    const res = await app.request(
      "/api/auth/providers",
      {},
      {
        ...TEST_ENV,
        OAUTH_GITHUB_CLIENT_ID: "id",
        OAUTH_GITHUB_CLIENT_SECRET: "secret",
        OAUTH_GOOGLE_CLIENT_ID: "id-without-secret",
      },
    );
    expect(authProvidersResponseSchema.parse(await res.json()).social).toEqual(["github"]);
  });
});

describe("configuration errors", () => {
  it("answers 500 when the Worker has no DATABASE_URL", async () => {
    const res = await createApp().request("/api/tasks", {}, TEST_ENV);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error:
        "DATABASE_URL is not set. Locally `pnpm dev:api` uses PGlite; in the Worker set the Neon URL.",
    });
  });
});
