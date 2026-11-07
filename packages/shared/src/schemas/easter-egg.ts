import { z } from "zod";

/**
 * Response body of `GET /api/easter-egg`: a fixed message from the backend, shown on the
 * home screen to prove the preview's app and API are both up and talking.
 */
export const easterEggResponseSchema = z.object({
  message: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type EasterEggResponse = z.infer<typeof easterEggResponseSchema>;
