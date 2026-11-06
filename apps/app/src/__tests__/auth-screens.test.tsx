import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { authClient, fakeSession, setSession } from "@/test-utils/auth-mock";
import { fetchMock, installFetchMock, jsonResponse } from "@/test-utils/fetch-mock";

beforeEach(() => {
  installFetchMock();
  // `/auth/providers` (OAuth buttons) and `/health`: answer with the defaults.
  fetchMock.mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith("/auth/providers")) {
      return jsonResponse({ emailAndPassword: true, social: [] });
    }
    return jsonResponse({ status: "ok", service: "api", timestamp: new Date().toISOString() });
  });
});

describe("sign-in screen", () => {
  it("validates the form before calling Better Auth", async () => {
    await renderRouter("./src/app", { initialUrl: "/sign-in" });

    await userEvent.setup().press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail inválido")).toBeOnTheScreen();
    expect(screen.getByText("Informe a senha")).toBeOnTheScreen();
    expect(authClient.signIn.email).not.toHaveBeenCalled();
  });

  it("signs in with email and password and opens the app", async () => {
    const user = userEvent.setup();
    authClient.signIn.email.mockImplementationOnce(async () => {
      setSession(fakeSession());
      return { data: {}, error: null };
    });
    await renderRouter("./src/app", { initialUrl: "/sign-in" });

    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "correct-horse");
    await user.press(screen.getByRole("button", { name: "Entrar" }));

    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "correct-horse",
    });
    expect(await screen.findByText("Foreman · Web + Mobile")).toBeOnTheScreen();
    expect(screen).toHavePathname("/");
  });

  it("shows a friendly message for wrong credentials", async () => {
    const user = userEvent.setup();
    authClient.signIn.email.mockResolvedValueOnce({
      data: null,
      error: {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
        status: 401,
      },
    });
    await renderRouter("./src/app", { initialUrl: "/sign-in" });

    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "wrong");
    await user.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeOnTheScreen();
    expect(screen).toHavePathname("/sign-in");
  });

  it("shows OAuth buttons only for providers enabled on the API", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ emailAndPassword: true, social: ["github"] }),
    );
    await renderRouter("./src/app", { initialUrl: "/sign-in" });

    const github = await screen.findByRole("button", { name: "Continuar com GitHub" });
    expect(screen.queryByRole("button", { name: "Continuar com Google" })).not.toBeOnTheScreen();

    await userEvent.setup().press(github);
    expect(authClient.signIn.social).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "github" }),
    );
  });

  it("links to sign-up", async () => {
    await renderRouter("./src/app", { initialUrl: "/sign-in" });

    await act(() => fireEvent.press(screen.getByText("Cadastre-se")));

    expect(await screen.findByRole("button", { name: "Criar conta" })).toBeOnTheScreen();
    expect(screen).toHavePathname("/sign-up");
  });
});

describe("sign-up screen", () => {
  it("creates the account with the trimmed name", async () => {
    const user = userEvent.setup();
    await renderRouter("./src/app", { initialUrl: "/sign-up" });

    await user.type(screen.getByLabelText("Nome"), "  Ana  ");
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "12345678");
    await user.press(screen.getByRole("button", { name: "Criar conta" }));

    expect(authClient.signUp.email).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@example.com",
      password: "12345678",
    });
  });

  it("requires a password with at least 8 characters", async () => {
    const user = userEvent.setup();
    await renderRouter("./src/app", { initialUrl: "/sign-up" });

    await user.type(screen.getByLabelText("Nome"), "Ana");
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "123");
    await user.press(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Use pelo menos 8 caracteres")).toBeOnTheScreen();
    expect(authClient.signUp.email).not.toHaveBeenCalled();
  });

  it("reports an email that is already taken", async () => {
    const user = userEvent.setup();
    authClient.signUp.email.mockResolvedValueOnce({
      data: null,
      error: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "exists", status: 422 },
    });
    await renderRouter("./src/app", { initialUrl: "/sign-up" });

    await user.type(screen.getByLabelText("Nome"), "Ana");
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "12345678");
    await user.press(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Já existe uma conta com este e-mail.")).toBeOnTheScreen();
  });
});
