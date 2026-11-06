import { z } from "zod";

/** Body of every error response from the API (4xx/5xx), outside `/api/auth/*`. */
export const apiErrorSchema = z.object({
  error: z.string(),
  issues: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
      }),
    )
    .optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
