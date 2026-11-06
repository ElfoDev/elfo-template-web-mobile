import {
  type AuthProvidersResponse,
  apiErrorSchema,
  authProvidersResponseSchema,
  type HealthResponse,
  healthResponseSchema,
  type Task,
  taskListResponseSchema,
  taskSchema,
} from "@repo/shared";
import { type ApiClient, createApiClient } from "@repo/shared/client";
import { Platform } from "react-native";
import { API_URL } from "./api-url";
import { authHeaders } from "./auth-client";

export { API_URL } from "./api-url";

/**
 * Typed API client. Authenticated routes need the session: the browser sends the cookie
 * (`credentials: "include"`); native apps send the cookie stored by Better Auth as a header.
 */
export const api: ApiClient = createApiClient(API_URL, {
  init: { credentials: Platform.OS === "web" ? "include" : "omit" },
  headers: authHeaders,
});

/** Error with the HTTP status, so screens can tell "signed out" (401) from other failures. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function errorFrom(res: {
  status: number;
  json(): Promise<unknown>;
}): Promise<ApiRequestError> {
  let message = `API respondeu ${res.status}`;
  try {
    const body = apiErrorSchema.safeParse(await res.json());
    if (body.success) message = body.data.issues?.[0]?.message ?? body.data.error;
  } catch {
    // Not JSON: keep the generic message.
  }
  if (res.status === 401) message = "Sua sessão expirou. Entre de novo.";
  return new ApiRequestError(message, res.status);
}

export async function fetchHealth(client: ApiClient = api): Promise<HealthResponse> {
  const res = await client.health.$get();
  if (!res.ok) throw new Error(`API respondeu ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}

export async function fetchAuthProviders(client: ApiClient = api): Promise<AuthProvidersResponse> {
  const res = await client.auth.providers.$get();
  if (!res.ok) throw await errorFrom(res);
  return authProvidersResponseSchema.parse(await res.json());
}

export async function fetchTasks(client: ApiClient = api): Promise<Task[]> {
  const res = await client.tasks.$get();
  if (!res.ok) throw await errorFrom(res);
  return taskListResponseSchema.parse(await res.json()).tasks;
}

export async function createTask(title: string, client: ApiClient = api): Promise<Task> {
  const res = await client.tasks.$post({ json: { title } });
  if (!res.ok) throw await errorFrom(res);
  return taskSchema.parse(await res.json());
}

export async function updateTask(
  id: string,
  changes: { title?: string; done?: boolean },
  client: ApiClient = api,
): Promise<Task> {
  const res = await client.tasks[":id"].$patch({ param: { id }, json: changes });
  if (!res.ok) throw await errorFrom(res);
  return taskSchema.parse(await res.json());
}

export async function deleteTask(id: string, client: ApiClient = api): Promise<void> {
  const res = await client.tasks[":id"].$delete({ param: { id } });
  if (!res.ok) throw await errorFrom(res);
}
