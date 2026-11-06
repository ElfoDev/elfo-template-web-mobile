import type { Task } from "@repo/shared";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import TasksScreen from "@/app/(tabs)/tasks";
import { authClientModule } from "@/test-utils/auth-mock";
import { fetchCall, fetchMock, installFetchMock, jsonResponse } from "@/test-utils/fetch-mock";

function task(overrides: Partial<Task> = {}): Task {
  const now = new Date("2026-01-15T12:00:00.000Z").toISOString();
  return {
    id: "6f1c1a52-6f7e-4a53-9a43-0d6a2b1c9e10",
    title: "Comprar pão",
    done: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const bread = task();
const bills = task({ id: "0b6c6a43-2c5d-4b8e-9f0a-1d2e3f4a5b6c", title: "Pagar contas" });

beforeEach(() => {
  installFetchMock();
});

describe("TasksScreen", () => {
  it("lists the user's tasks", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [bread, bills] }));

    await render(<TasksScreen />);

    expect(await screen.findByText("Comprar pão")).toBeOnTheScreen();
    expect(screen.getByText("Pagar contas")).toBeOnTheScreen();
    expect(fetchCall(0)).toMatchObject({ method: "GET", url: expect.stringMatching(/\/tasks$/) });
  });

  it("shows an empty state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [] }));

    await render(<TasksScreen />);

    expect(await screen.findByText(/Nenhuma tarefa ainda/)).toBeOnTheScreen();
  });

  it("creates a task and clears the input", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [] }));
    await render(<TasksScreen />);
    await screen.findByText(/Nenhuma tarefa ainda/);

    fetchMock.mockResolvedValueOnce(jsonResponse(bread, 201));
    const input = screen.getByLabelText("Nova tarefa");
    await user.type(input, "  Comprar pão ");
    await user.press(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Comprar pão")).toBeOnTheScreen();
    expect(fetchCall(1)).toMatchObject({ method: "POST", body: { title: "Comprar pão" } });
    expect(input).toHaveDisplayValue("");
  });

  it("gives the title back when creating fails", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [] }));
    await render(<TasksScreen />);
    await screen.findByText(/Nenhuma tarefa ainda/);

    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));
    const input = screen.getByLabelText("Nova tarefa");
    await user.type(input, "Comprar pão");
    await user.press(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Network request failed")).toBeOnTheScreen();
    expect(input).toHaveDisplayValue("Comprar pão");
  });

  it("validates the title before calling the API", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [] }));
    await render(<TasksScreen />);
    await screen.findByText(/Nenhuma tarefa ainda/);

    await user.press(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Informe um título")).toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("completes a task", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [bread] }));
    await render(<TasksScreen />);
    const checkbox = await screen.findByRole("checkbox", { name: "Comprar pão" });
    expect(checkbox).not.toBeChecked();

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...bread, done: true }));
    await user.press(checkbox);

    expect(
      await screen.findByRole("checkbox", { name: "Comprar pão", checked: true }),
    ).toBeTruthy();
    expect(fetchCall(1)).toMatchObject({
      method: "PATCH",
      url: expect.stringMatching(new RegExp(`/tasks/${bread.id}$`)),
      body: { done: true },
    });
  });

  it("deletes a task", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [bread, bills] }));
    await render(<TasksScreen />);
    await screen.findByText("Comprar pão");

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() } as Response);
    await user.press(screen.getByRole("button", { name: 'Apagar "Comprar pão"' }));

    expect(await screen.findByText("Pagar contas")).toBeOnTheScreen();
    expect(screen.queryByText("Comprar pão")).not.toBeOnTheScreen();
    expect(fetchCall(1)).toMatchObject({ method: "DELETE" });
  });

  it("shows API errors from mutations and keeps the list", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [bread] }));
    await render(<TasksScreen />);
    await screen.findByText("Comprar pão");

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Not Found" }, 404));
    await user.press(screen.getByRole("button", { name: 'Apagar "Comprar pão"' }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Not Found")).toBeOnTheScreen();
    expect(screen.getByText("Comprar pão")).toBeOnTheScreen();
  });

  it("refreshes the session when the API answers 401", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));

    await render(<TasksScreen />);

    expect(await screen.findByText("Sua sessão expirou. Entre de novo.")).toBeOnTheScreen();
    expect(authClientModule.refreshSession).toHaveBeenCalled();
  });
});
