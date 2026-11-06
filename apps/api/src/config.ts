import type { Bindings } from "./env";

/**
 * A missing or unsafe setting. The message says what to set and never includes a value, so
 * `app.onError` can return it to the client as a 500 instead of a generic error.
 */
export class ConfigError extends Error {
  override name = "ConfigError";
}

/** True only for local development (`ENVIRONMENT=development`). Everything else fails closed. */
export function isDevelopment(env: Bindings): boolean {
  return env.ENVIRONMENT === "development";
}

/** Splits a comma-separated binding into trimmed, non-empty items. */
export function parseList(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}
