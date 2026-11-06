import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";

describe("createApiClient", () => {
  it("calls GET /health on the given base URL", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ status: "ok", service: "api", timestamp: new Date().toISOString() }),
    );
    const api = createApiClient("https://api.example.com/", { fetch: fetchMock });

    const res = await api.health.$get();

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [input] = fetchMock.mock.calls[0] ?? [];
    expect(String(input instanceof Request ? input.url : input)).toBe(
      "https://api.example.com/health",
    );
  });
});
