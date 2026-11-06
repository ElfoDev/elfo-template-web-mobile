import { describe, expect, it } from "vitest";
import { createTaskSchema, taskParamsSchema, taskSchema, updateTaskSchema } from "./task";

describe("createTaskSchema", () => {
  it("trims the title", () => {
    expect(createTaskSchema.parse({ title: "  Comprar pão " })).toEqual({ title: "Comprar pão" });
  });

  it("rejects blank and too long titles", () => {
    expect(createTaskSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "x".repeat(200) }).success).toBe(true);
  });
});

describe("updateTaskSchema", () => {
  it("accepts a partial update", () => {
    expect(updateTaskSchema.parse({ done: true })).toEqual({ done: true });
    expect(updateTaskSchema.parse({ title: " Novo " })).toEqual({ title: "Novo" });
  });

  it("requires at least one field", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });
});

describe("taskSchema", () => {
  it("accepts a task from the API", () => {
    const now = new Date().toISOString();
    const task = {
      id: "6f1c1a52-6f7e-4a53-9a43-0d6a2b1c9e10",
      title: "Pagar contas",
      done: false,
      createdAt: now,
      updatedAt: now,
    };
    expect(taskSchema.parse(task)).toEqual(task);
  });
});

describe("taskParamsSchema", () => {
  it("only accepts UUIDs", () => {
    expect(taskParamsSchema.safeParse({ id: "1" }).success).toBe(false);
    expect(taskParamsSchema.safeParse({ id: "6f1c1a52-6f7e-4a53-9a43-0d6a2b1c9e10" }).success).toBe(
      true,
    );
  });
});
