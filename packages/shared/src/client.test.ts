import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";

describe("createApiClient", () => {
  it("calls GET /api/health on the given base URL", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ status: "ok", service: "api", timestamp: new Date().toISOString() }),
    );
    const api = createApiClient("https://api.example.com/", { fetch: fetchMock });

    const res = await api.health.$get();

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [input] = fetchMock.mock.calls[0] ?? [];
    expect(String(input instanceof Request ? input.url : input)).toBe(
      "https://api.example.com/api/health",
    );
  });

  it("exposes the tasks routes with typed params and forwards init options", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const api = createApiClient("https://api.example.com", {
      fetch: fetchMock,
      init: { credentials: "include" },
    });

    await api.tasks[":id"].$delete({ param: { id: "6f1c1a52-6f7e-4a53-9a43-0d6a2b1c9e10" } });

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(input instanceof Request ? input.url : input)).toBe(
      "https://api.example.com/api/tasks/6f1c1a52-6f7e-4a53-9a43-0d6a2b1c9e10",
    );
    expect(init?.method).toBe("DELETE");
    expect(init?.credentials).toBe("include");
  });
});
