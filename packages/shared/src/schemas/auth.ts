import { z } from "zod";

/** OAuth providers the API can enable (each one only when its client id and secret are set). */
export const socialProviderSchema = z.enum(["github", "google"]);

export type SocialProvider = z.infer<typeof socialProviderSchema>;

/** Response body of `GET /api/auth/providers`. */
export const authProvidersResponseSchema = z.object({
  emailAndPassword: z.boolean(),
  social: z.array(socialProviderSchema),
});

export type AuthProvidersResponse = z.infer<typeof authProvidersResponseSchema>;

/** Minimum password length. The API enforces it too (`minPasswordLength` in `auth.ts`). */
export const PASSWORD_MIN_LENGTH = 8;

export const signInSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome"),
  email: z.email("E-mail inválido"),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres`),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
