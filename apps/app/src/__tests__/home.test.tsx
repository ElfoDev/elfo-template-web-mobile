import { render, screen, userEvent } from "@testing-library/react-native";
import HomeScreen from "@/app/(tabs)/index";

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe("HomeScreen", () => {
  it("shows the API as online when /health answers ok", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "ok", service: "api", timestamp: new Date().toISOString() }),
    );

    await render(<HomeScreen />);

    expect(await screen.findByText("● Online")).toBeOnTheScreen();
    const [input] = fetchMock.mock.calls[0] ?? [];
    expect(String(input instanceof Request ? input.url : input)).toMatch(/\/health$/);
  });

  it("shows the error and retries", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));

    await render(<HomeScreen />);

    expect(await screen.findByText("● Offline")).toBeOnTheScreen();
    expect(screen.getByText("Network request failed")).toBeOnTheScreen();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "ok", service: "api", timestamp: new Date().toISOString() }),
    );
    await userEvent.setup().press(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("● Online")).toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a non-2xx response as offline", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

    await render(<HomeScreen />);

    expect(await screen.findByText("API respondeu 500")).toBeOnTheScreen();
  });
});
