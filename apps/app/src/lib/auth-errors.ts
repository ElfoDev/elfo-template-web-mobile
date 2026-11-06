/**
 * Turns a Better Auth error into a message for the user. Known codes get a
 * Portuguese message; anything else falls back to the server message.
 */
export function authErrorMessage(error: {
  code?: string;
  message?: string;
  status?: number;
}): string {
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-mail ou senha incorretos.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Já existe uma conta com este e-mail.";
    case "PASSWORD_TOO_SHORT":
      return "Senha muito curta.";
    case "INVALID_EMAIL":
      return "E-mail inválido.";
  }
  if (error.status === 0 || !error.status) return "Não foi possível falar com a API.";
  return error.message || `Erro ${error.status}`;
}
