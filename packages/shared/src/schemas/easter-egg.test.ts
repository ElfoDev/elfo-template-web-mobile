import { describe, expect, it } from "vitest";
import { easterEggResponseSchema } from "./easter-egg";

describe("easterEggResponseSchema", () => {
  it("accepts a valid payload", () => {
    const payload = { message: "🥚 Oi", timestamp: new Date().toISOString() };
    expect(easterEggResponseSchema.parse(payload)).toEqual(payload);
  });

  it("rejects an empty message", () => {
    const result = easterEggResponseSchema.safeParse({
      message: "",
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non ISO timestamp", () => {
    const result = easterEggResponseSchema.safeParse({ message: "🥚", timestamp: "ontem" });
    expect(result.success).toBe(false);
  });
});
