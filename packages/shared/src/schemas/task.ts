import { z } from "zod";

export const TASK_TITLE_MAX_LENGTH = 200;

/** Title of a task: trimmed, 1 to 200 characters. */
export const taskTitleSchema = z
  .string()
  .trim()
  .min(1, "Informe um título")
  .max(TASK_TITLE_MAX_LENGTH, `Use no máximo ${TASK_TITLE_MAX_LENGTH} caracteres`);

/** A task as returned by the API. Tasks always belong to the signed-in user. */
export const taskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Task = z.infer<typeof taskSchema>;

/** Response body of `GET /tasks` (newest first). */
export const taskListResponseSchema = z.object({
  tasks: z.array(taskSchema),
});

export type TaskListResponse = z.infer<typeof taskListResponseSchema>;

/** Request body of `POST /tasks`. */
export const createTaskSchema = z.object({
  title: taskTitleSchema,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Request body of `PATCH /tasks/:id`: at least one field. */
export const updateTaskSchema = z
  .object({
    title: taskTitleSchema.optional(),
    done: z.boolean().optional(),
  })
  .refine((input) => input.title !== undefined || input.done !== undefined, {
    message: "Informe title ou done",
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Path params of `/tasks/:id`. */
export const taskParamsSchema = z.object({
  id: z.uuid(),
});
