type Issue = { path: readonly PropertyKey[]; message: string };

/** First error message per top-level field, from a failed zod `safeParse` (`result.error`). */
export function fieldErrors<T>(error: {
  issues: readonly Issue[];
}): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof T | undefined;
    if (key !== undefined && errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}
