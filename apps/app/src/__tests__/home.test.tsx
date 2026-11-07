import { render, screen, userEvent, within } from "@testing-library/react-native";
import HomeScreen from "@/app/(tabs)/index";
import { fetchMock, installFetchMock, jsonResponse } from "@/test-utils/fetch-mock";

type Responder = () => Promise<Response>;

const healthOk: Responder = async () =>
  jsonResponse({ status: "ok", service: "api", timestamp: new Date().toISOString() });

const easterEggOk =
  (message = "🥚 Você encontrou o Easter Egg do backend"): Responder =>
  async () =>
    jsonResponse({ message, timestamp: new Date().toISOString() });

function urlOf(input: Parameters<typeof fetch>[0]): string {
  return String(input instanceof Request ? input.url : input);
}

/** The home screen fetches `/api/health` and `/api/easter-egg` in parallel: answer by URL. */
function routeFetch(routes: { health: Responder; easterEgg: Responder }) {
  fetchMock.mockImplementation((input) => {
    const url = urlOf(input);
    if (/\/api\/health$/.test(url)) return routes.health();
    if (/\/api\/easter-egg$/.test(url)) return routes.easterEgg();
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function callsTo(pattern: RegExp): number {
  return fetchMock.mock.calls.filter(([input]) => pattern.test(urlOf(input))).length;
}

beforeEach(() => {
  installFetchMock();
});

describe("HomeScreen", () => {
  it("shows the API as online when /api/health answers ok", async () => {
    routeFetch({ health: healthOk, easterEgg: easterEggOk() });

    await render(<HomeScreen />);

    expect(await screen.findByText("● Online")).toBeOnTheScreen();
    expect(callsTo(/\/api\/health$/)).toBe(1);
  });

  it("shows the error and retries", async () => {
    let healthUp = false;
    routeFetch({
      health: () => (healthUp ? healthOk() : Promise.reject(new Error("Network request failed"))),
      easterEgg: easterEggOk(),
    });

    await render(<HomeScreen />);

    expect(await screen.findByText("● Offline")).toBeOnTheScreen();
    expect(screen.getByText("Network request failed")).toBeOnTheScreen();

    healthUp = true;
    await userEvent.setup().press(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("● Online")).toBeOnTheScreen();
    expect(callsTo(/\/api\/health$/)).toBe(2);
  });

  it("reports a non-2xx response as offline", async () => {
    routeFetch({
      health: async () => jsonResponse({ error: "boom" }, 500),
      easterEgg: easterEggOk(),
    });

    await render(<HomeScreen />);

    expect(await screen.findByText("API respondeu 500")).toBeOnTheScreen();
  });
});

describe("HomeScreen Easter Egg", () => {
  it("shows the front-end Easter Egg right away, before the API answers", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    await render(<HomeScreen />);

    const egg = screen.getByTestId("easter-egg");
    expect(within(egg).getByText("🥚")).toBeOnTheScreen();
    expect(within(egg).getByText("Easter Egg do preview")).toBeOnTheScreen();
  });

  it("shows the message that comes from GET /api/easter-egg", async () => {
    routeFetch({ health: healthOk, easterEgg: easterEggOk("🥚 Mensagem trocada no backend") });

    await render(<HomeScreen />);

    expect(await screen.findByText("🥚 Mensagem trocada no backend")).toBeOnTheScreen();
    expect(callsTo(/\/api\/easter-egg$/)).toBe(1);
  });

  it("shows a discreet error when the API answers an error, keeping the screen working", async () => {
    routeFetch({ health: healthOk, easterEgg: async () => jsonResponse({ error: "boom" }, 500) });

    await render(<HomeScreen />);

    expect(
      await screen.findByText("Easter Egg do backend indisponível (API respondeu 500)"),
    ).toBeOnTheScreen();
    expect(screen.getByText("Easter Egg do preview")).toBeOnTheScreen();
    expect(await screen.findByText("● Online")).toBeOnTheScreen();
  });

  it("shows a discreet error when the API is down", async () => {
    routeFetch({
      health: () => Promise.reject(new Error("Network request failed")),
      easterEgg: () => Promise.reject(new Error("Network request failed")),
    });

    await render(<HomeScreen />);

    expect(
      await screen.findByText("Easter Egg do backend indisponível (Network request failed)"),
    ).toBeOnTheScreen();
    expect(screen.getByText("Easter Egg do preview")).toBeOnTheScreen();
    expect(screen.getByText("● Offline")).toBeOnTheScreen();
  });

  it("rejects a response that does not match the shared schema", async () => {
    routeFetch({ health: healthOk, easterEgg: async () => jsonResponse({ message: "" }) });

    await render(<HomeScreen />);

    expect(
      await screen.findByText("Easter Egg do backend indisponível (resposta inválida da API)"),
    ).toBeOnTheScreen();
  });
});
