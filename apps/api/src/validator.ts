import { zValidator } from "@hono/zod-validator";
import type { ApiError } from "@repo/shared";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

/**
 * `zValidator` that answers invalid input with `400 { error, issues }` (see `apiErrorSchema`),
 * or with a plain 404 for path params (an invalid id is just a resource that does not exist).
 */
export function validate<Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result, c) => {
    if (result.success) return;
    if (target === "param") return c.json({ error: "Not Found" } satisfies ApiError, 404);
    const body: ApiError = {
      error: "Invalid request",
      issues: result.error.issues.map((issue) => ({
        path: issue.path.map((key) => (typeof key === "number" ? key : String(key))),
        message: issue.message,
      })),
    };
    return c.json(body, 400);
  });
}
