import { executePlannedCommit } from "@/server/automation/job-runner";
import { getRunNowGate } from "@/server/automation/run-now-policy";
import { getSessionUserId } from "@/server/auth/session";
import { createManualPlannedCommit } from "@/server/db/repository";
import { isDatabaseConfigured } from "@/server/db/client";
import { RunNowSchema } from "@/server/automation/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const raw: unknown = await request.json();
  const input = RunNowSchema.parse(raw);
  const userId = await getSessionUserId();
  const gate = getRunNowGate({ userId, databaseConfigured: isDatabaseConfigured() });

  if (!gate.allowed) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  const authenticatedUserId = userId;
  if (!authenticatedUserId) {
    return Response.json({ error: "Connect GitHub before queueing a real commit." }, { status: 401 });
  }

  const planned = await createManualPlannedCommit(authenticatedUserId, input.scheduleId);
  const result = await executePlannedCommit(planned.id);
  return Response.json({ plannedCommitId: planned.id, result });
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "Use POST to run a schedule now." }, { status: 405 });
}
