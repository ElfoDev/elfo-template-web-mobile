import { z } from "zod";

/** Response body of `GET /api/health` (the Worker is up; no database involved). */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Response body of `GET /api/health/db`: the Worker reached the database. The deploy's smoke
 * test calls it; any failure answers 500 instead.
 */
export const databaseHealthResponseSchema = z.object({
  status: z.literal("ok"),
  database: z.literal("ok"),
});

export type DatabaseHealthResponse = z.infer<typeof databaseHealthResponseSchema>;
