import { render, screen, userEvent } from "@testing-library/react-native";
import ProfileScreen from "@/app/(tabs)/profile";
import { authClient, fakeSession, setSession } from "@/test-utils/auth-mock";

describe("ProfileScreen", () => {
  it("shows the signed-in user", async () => {
    setSession(fakeSession({ name: "Ana Souza", email: "ana@example.com" }));

    await render(<ProfileScreen />);

    expect(screen.getByText("Ana Souza")).toBeOnTheScreen();
    expect(screen.getByText("ana@example.com")).toBeOnTheScreen();
    expect(screen.getByText("A")).toBeOnTheScreen();
  });

  it("signs out", async () => {
    setSession(fakeSession());
    await render(<ProfileScreen />);

    await userEvent.setup().press(screen.getByRole("button", { name: "Sair" }));

    expect(authClient.signOut).toHaveBeenCalledTimes(1);
  });

  it("shows sign-out errors", async () => {
    setSession(fakeSession());
    authClient.signOut.mockResolvedValueOnce({
      data: null,
      error: { message: "Falhou", status: 500 },
    });
    await render(<ProfileScreen />);

    await userEvent.setup().press(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByText("Falhou")).toBeOnTheScreen();
  });
});
