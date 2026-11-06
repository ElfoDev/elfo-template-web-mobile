import { createApp } from "../app";
import { createPgliteDb, type PgliteDb } from "../db/pglite";
import type { Bindings } from "../env";

/** Origin of the Expo web dev server: trusted in development, so browsers may send cookies. */
export const WEB_ORIGIN = "http://localhost:8081";

/** Local-development bindings (`ENVIRONMENT=development`): defaults on, rate limit off. */
export const TEST_ENV: Bindings = {
  ENVIRONMENT: "development",
  CORS_ORIGINS: "*",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-test-secret",
  BETTER_AUTH_URL: "http://localhost:8787",
};

export type TestApi = Awaited<ReturnType<typeof createTestApi>>;

/**
 * The real app against a fresh in-memory PGlite (all migrations applied).
 * Call `close()` in `afterAll`.
 */
export async function createTestApi(env: Bindings = TEST_ENV) {
  const pglite: PgliteDb = await createPgliteDb();
  const app = createApp({ db: pglite.db });

  /** `app.request` with the test bindings and a trusted `Origin`. */
  function request(path: string, init: RequestInit & { cookie?: string } = {}) {
    const { cookie, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (!headers.has("origin")) headers.set("origin", WEB_ORIGIN);
    if (cookie) headers.set("cookie", cookie);
    if (rest.body !== undefined && rest.body !== null && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return app.request(path, { ...rest, headers }, env);
  }

  /** Signs up a user with email + password and returns the session `Cookie` header. */
  async function signUp(email: string, name = email.split("@")[0] ?? "User") {
    const res = await request("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password: "correct-horse-battery" }),
    });
    if (res.status !== 200) {
      throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
    }
    return cookieFrom(res);
  }

  return { app, db: pglite.db, env, request, signUp, close: pglite.close };
}

/** Turns the `Set-Cookie` headers of a response into a `Cookie` request header. */
export function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
