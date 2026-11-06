import { renderRouter, screen } from "expo-router/testing-library";

beforeEach(() => {
  globalThis.fetch = jest.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
});

describe("navigation", () => {
  it("opens on the home tab and exposes both tabs", async () => {
    await renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByText("Foreman · Web + Mobile")).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
    expect(screen.getAllByText("Início").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sobre").length).toBeGreaterThan(0);
  });

  it("renders the about tab", async () => {
    await renderRouter("./src/app", { initialUrl: "/about" });

    expect(await screen.findByText("Stack")).toBeOnTheScreen();
    expect(screen).toHavePathname("/about");
  });
});
