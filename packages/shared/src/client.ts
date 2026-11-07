import type { AppType } from "@repo/api";
import { hc } from "hono/client";

/** Every API route lives under `/api` (the same Worker serves the web app at `/`). */
export type ApiClient = ReturnType<typeof hc<AppType>>["api"];

export type ApiClientOptions = Parameters<typeof hc>[1];

/**
 * Typed API client (Hono RPC). Routes, params and response bodies are inferred
 * from the API's `AppType`, so a change in the API breaks the app at compile time.
 *
 * `baseUrl` is the API's origin (no `/api`): the client is rooted at `/api`, so
 * `api.health.$get()` calls `<baseUrl>/api/health`.
 *
 * @example
 * const api = createApiClient("http://localhost:8787");
 * const res = await api.health.$get();
 */
export function createApiClient(baseUrl: string, options?: ApiClientOptions): ApiClient {
  return hc<AppType>(baseUrl.replace(/\/+$/, ""), options).api;
}
