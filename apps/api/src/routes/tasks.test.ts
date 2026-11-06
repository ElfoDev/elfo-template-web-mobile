import { apiErrorSchema, taskListResponseSchema, taskSchema } from "@repo/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApi, type TestApi } from "../test/helpers";

let api: TestApi;
let alice: string;
let bob: string;

beforeAll(async () => {
  api = await createTestApi();
  alice = await api.signUp("alice@example.com");
  bob = await api.signUp("bob@example.com");
});

afterAll(async () => {
  await api.close();
});

async function createTask(cookie: string, title: string) {
  const res = await api.request("/tasks", {
    method: "POST",
    cookie,
    body: JSON.stringify({ title }),
  });
  expect(res.status).toBe(201);
  return taskSchema.parse(await res.json());
}

async function listTasks(cookie: string) {
  const res = await api.request("/tasks", { cookie });
  expect(res.status).toBe(200);
  return taskListResponseSchema.parse(await res.json()).tasks;
}

describe("tasks without a session", () => {
  it.each([
    ["GET", "/tasks"],
    ["POST", "/tasks"],
    ["PATCH", "/tasks/00000000-0000-4000-8000-000000000000"],
    ["DELETE", "/tasks/00000000-0000-4000-8000-000000000000"],
  ])("%s %s answers 401", async (method, path) => {
    const body = method === "POST" || method === "PATCH" ? JSON.stringify({ title: "x" }) : null;
    const res = await api.request(path, { method, body });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects an invalid session cookie", async () => {
    const res = await api.request("/tasks", { cookie: "better-auth.session_token=forged" });
    expect(res.status).toBe(401);
  });
});

describe("tasks CRUD", () => {
  it("creates, lists (newest first), completes, renames and deletes", async () => {
    const cookie = await api.signUp("crud@example.com");
    expect(await listTasks(cookie)).toEqual([]);

    const first = await createTask(cookie, "  Comprar pão  ");
    expect(first).toMatchObject({ title: "Comprar pão", done: false });
    const second = await createTask(cookie, "Pagar contas");

    expect((await listTasks(cookie)).map((t) => t.id)).toEqual([second.id, first.id]);

    const done = await api.request(`/tasks/${first.id}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ done: true }),
    });
    expect(done.status).toBe(200);
    expect(taskSchema.parse(await done.json())).toMatchObject({ id: first.id, done: true });

    const renamed = await api.request(`/tasks/${first.id}`, {
      method: "PATCH",
      cookie,
      body: JSON.stringify({ title: "Comprar pão integral" }),
    });
    expect(taskSchema.parse(await renamed.json())).toMatchObject({
      title: "Comprar pão integral",
      done: true,
    });

    const removed = await api.request(`/tasks/${first.id}`, { method: "DELETE", cookie });
    expect(removed.status).toBe(204);
    expect((await listTasks(cookie)).map((t) => t.id)).toEqual([second.id]);

    const again = await api.request(`/tasks/${first.id}`, { method: "DELETE", cookie });
    expect(again.status).toBe(404);
  });

  it("validates the body with the shared schema", async () => {
    const empty = await api.request("/tasks", {
      method: "POST",
      cookie: alice,
      body: JSON.stringify({ title: "   " }),
    });
    expect(empty.status).toBe(400);
    const body = apiErrorSchema.parse(await empty.json());
    expect(body.issues?.[0]?.path).toEqual(["title"]);

    const tooLong = await api.request("/tasks", {
      method: "POST",
      cookie: alice,
      body: JSON.stringify({ title: "x".repeat(201) }),
    });
    expect(tooLong.status).toBe(400);

    const task = await createTask(alice, "Válida");
    const nothing = await api.request(`/tasks/${task.id}`, {
      method: "PATCH",
      cookie: alice,
      body: JSON.stringify({}),
    });
    expect(nothing.status).toBe(400);
  });

  it("answers 404 for ids that are not UUIDs", async () => {
    const res = await api.request("/tasks/not-a-uuid", { method: "DELETE", cookie: alice });
    expect(res.status).toBe(404);
  });
});

describe("authorization between users", () => {
  it("only lists the caller's own tasks", async () => {
    const mine = await createTask(alice, "Da Alice");
    const theirs = await createTask(bob, "Do Bob");

    const aliceIds = (await listTasks(alice)).map((t) => t.id);
    const bobIds = (await listTasks(bob)).map((t) => t.id);

    expect(aliceIds).toContain(mine.id);
    expect(aliceIds).not.toContain(theirs.id);
    expect(bobIds).toEqual([theirs.id]);
  });

  it("cannot update or delete another user's task", async () => {
    const task = await createTask(alice, "Privada");

    const update = await api.request(`/tasks/${task.id}`, {
      method: "PATCH",
      cookie: bob,
      body: JSON.stringify({ done: true, title: "Hackeada" }),
    });
    expect(update.status).toBe(404);

    const remove = await api.request(`/tasks/${task.id}`, { method: "DELETE", cookie: bob });
    expect(remove.status).toBe(404);

    const stillThere = (await listTasks(alice)).find((t) => t.id === task.id);
    expect(stillThere).toMatchObject({ title: "Privada", done: false });
  });
});
