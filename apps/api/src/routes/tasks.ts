import {
  createTaskSchema,
  type Task,
  type TaskListResponse,
  taskParamsSchema,
  updateTaskSchema,
} from "@repo/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type TaskRow, task } from "../db/schema";
import type { AppEnv } from "../env";
import { requireUser } from "../middleware/require-user";
import { validate } from "../validator";

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * CRUD of the signed-in user's tasks. Every query is scoped by `userId`, so another
 * user's task id behaves exactly like an id that does not exist (404).
 */
export const taskRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", async (c) => {
    const rows = await c.var.services.db
      .select()
      .from(task)
      .where(eq(task.userId, c.var.user.id))
      .orderBy(desc(task.createdAt), desc(task.id));
    const body: TaskListResponse = { tasks: rows.map(toTask) };
    return c.json(body, 200);
  })
  .post("/", validate("json", createTaskSchema), async (c) => {
    const { title } = c.req.valid("json");
    const [row] = await c.var.services.db
      .insert(task)
      .values({ userId: c.var.user.id, title })
      .returning();
    if (!row) throw new Error("Insert returned no row");
    return c.json(toTask(row), 201);
  })
  .patch(
    "/:id",
    validate("param", taskParamsSchema),
    validate("json", updateTaskSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { title, done } = c.req.valid("json");
      const [row] = await c.var.services.db
        .update(task)
        .set({ title, done, updatedAt: new Date() })
        .where(and(eq(task.id, id), eq(task.userId, c.var.user.id)))
        .returning();
      if (!row) return c.json({ error: "Not Found" }, 404);
      return c.json(toTask(row), 200);
    },
  )
  .delete("/:id", validate("param", taskParamsSchema), async (c) => {
    const { id } = c.req.valid("param");
    const [row] = await c.var.services.db
      .delete(task)
      .where(and(eq(task.id, id), eq(task.userId, c.var.user.id)))
      .returning({ id: task.id });
    if (!row) return c.json({ error: "Not Found" }, 404);
    return c.body(null, 204);
  });
