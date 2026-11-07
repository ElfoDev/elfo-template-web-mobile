import { describe, expect, it } from "vitest";
import { databaseHealthResponseSchema, healthResponseSchema } from "./health";

describe("healthResponseSchema", () => {
  it("accepts a valid payload", () => {
    const payload = { status: "ok", service: "api", timestamp: new Date().toISOString() };
    expect(healthResponseSchema.parse(payload)).toEqual(payload);
  });

  it("rejects an unexpected status", () => {
    const result = healthResponseSchema.safeParse({
      status: "down",
      service: "api",
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non ISO timestamp", () => {
    const result = healthResponseSchema.safeParse({
      status: "ok",
      service: "api",
      timestamp: "yesterday",
    });
    expect(result.success).toBe(false);
  });
});

describe("databaseHealthResponseSchema", () => {
  it("accepts ok", () => {
    const payload = { status: "ok", database: "ok" };
    expect(databaseHealthResponseSchema.parse(payload)).toEqual(payload);
  });

  it("rejects anything but ok", () => {
    expect(databaseHealthResponseSchema.safeParse({ status: "ok", database: "down" }).success).toBe(
      false,
    );
  });
});
