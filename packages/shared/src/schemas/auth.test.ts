import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "./auth";

describe("signInSchema", () => {
  it("requires a valid email and a password", () => {
    expect(signInSchema.safeParse({ email: "ana@example.com", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "ana", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "ana@example.com", password: "" }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("requires a name and a password with 8+ characters", () => {
    const valid = { name: " Ana ", email: "ana@example.com", password: "12345678" };
    expect(signUpSchema.parse(valid).name).toBe("Ana");
    expect(signUpSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
  });
});
