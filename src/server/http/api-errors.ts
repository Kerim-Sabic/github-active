import { ZodError } from "zod";

export function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    const missing = error.issues
      .filter((issue) => issue.code === "invalid_type" && issue.path.length > 0)
      .map((issue) => String(issue.path[0]));

    if (missing.length > 0) {
      return `Missing or invalid fields: ${Array.from(new Set(missing)).join(", ")}.`;
    }

    return error.issues[0]?.message ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
