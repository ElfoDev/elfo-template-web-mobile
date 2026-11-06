import type { AppType } from "@repo/api";
import { hc } from "hono/client";

export type ApiClient = ReturnType<typeof hc<AppType>>;

export type ApiClientOptions = Parameters<typeof hc>[1];

/**
 * Typed API client (Hono RPC). Routes, params and response bodies are inferred
 * from the API's `AppType`, so a change in the API breaks the app at compile time.
 *
 * @example
 * const api = createApiClient("http://localhost:8787");
 * const res = await api.health.$get();
 */
export function createApiClient(baseUrl: string, options?: ApiClientOptions): ApiClient {
  return hc<AppType>(baseUrl.replace(/\/+$/, ""), options);
}
