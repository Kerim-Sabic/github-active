export type RunNowGate =
  | { allowed: true }
  | { allowed: false; status: 401 | 503; error: string };

export function getRunNowGate(input: {
  userId: string | null;
  databaseConfigured: boolean;
}): RunNowGate {
  if (!input.userId) {
    return {
      allowed: false,
      status: 401,
      error: "Connect GitHub before queueing a real commit."
    };
  }

  if (!input.databaseConfigured) {
    return {
      allowed: false,
      status: 503,
      error: "Database is not configured, so commit jobs cannot be queued."
    };
  }

  return { allowed: true };
}
