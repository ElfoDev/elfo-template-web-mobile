import { act, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { fakeSession, setSession } from "@/test-utils/auth-mock";

beforeEach(() => {
  // Screens fetch on mount; never resolve so nothing updates after the assertions.
  globalThis.fetch = jest.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
});

describe("route guard", () => {
  it("sends signed-out users to sign-in", async () => {
    await renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByText("Acesse sua conta para ver suas tarefas.")).toBeOnTheScreen();
    expect(screen).toHavePathname("/sign-in");
  });

  it("does not open protected tabs by URL when signed out", async () => {
    await renderRouter("./src/app", { initialUrl: "/tasks" });

    expect(await screen.findByText("Acesse sua conta para ver suas tarefas.")).toBeOnTheScreen();
    expect(screen).toHavePathname("/sign-in");
  });

  it("goes back to sign-in when the session ends", async () => {
    setSession(fakeSession());
    await renderRouter("./src/app", { initialUrl: "/profile" });
    expect(await screen.findByText("ana@example.com")).toBeOnTheScreen();

    await act(async () => setSession(null));

    expect(await screen.findByText("Acesse sua conta para ver suas tarefas.")).toBeOnTheScreen();
    expect(screen).toHavePathname("/sign-in");
  });

  it("keeps signed-in users out of sign-in", async () => {
    setSession(fakeSession());
    await renderRouter("./src/app", { initialUrl: "/sign-in" });

    expect(await screen.findByText("Elfo · Web + Mobile")).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
  });
});

describe("tabs (signed in)", () => {
  beforeEach(() => {
    setSession(fakeSession());
  });

  it("opens on the home tab and exposes every tab", async () => {
    await renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByText("Elfo · Web + Mobile")).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
    for (const tab of ["Início", "Tarefas", "Perfil", "Sobre"]) {
      expect(screen.getAllByText(tab).length).toBeGreaterThan(0);
    }
  });

  it("renders the about tab", async () => {
    await renderRouter("./src/app", { initialUrl: "/about" });

    expect(await screen.findByText("Stack")).toBeOnTheScreen();
    expect(screen).toHavePathname("/about");
  });

  it("renders the tasks tab", async () => {
    await renderRouter("./src/app", { initialUrl: "/tasks" });

    expect(await screen.findByLabelText("Nova tarefa")).toBeOnTheScreen();
    expect(screen).toHavePathname("/tasks");
  });
});
