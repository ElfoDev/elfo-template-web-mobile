/** Minimal `Response` for the typed client (it only reads ok, status, headers and json). */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as Response;
}

export const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

/** Replaces `globalThis.fetch` with `fetchMock` (call in `beforeEach`). */
export function installFetchMock(): void {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

/** Method and URL of the n-th fetch call. */
export function fetchCall(index: number): { method: string; url: string; body: unknown } {
  const [input, init] = fetchMock.mock.calls[index] ?? [];
  const url = String(input instanceof Request ? input.url : input);
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  return { method: method.toUpperCase(), url, body };
}
