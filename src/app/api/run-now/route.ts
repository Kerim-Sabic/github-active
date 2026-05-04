import { executePlannedCommit } from "@/server/automation/job-runner";
import { getSessionUserId } from "@/server/auth/session";
import { createManualPlannedCommit } from "@/server/db/repository";
import { getDemoDashboardData } from "@/server/db/demo-data";
import { isDatabaseConfigured } from "@/server/db/client";
import { RunNowSchema } from "@/server/automation/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const raw: unknown = await request.json();
  const input = RunNowSchema.parse(raw);
  const userId = await getSessionUserId();

  if (!userId || !isDatabaseConfigured()) {
    const schedule = getDemoDashboardData().schedules[0];
    return Response.json({
      mode: "demo",
      queued: false,
      scheduleId: schedule?.id ?? input.scheduleId
    });
  }

  const planned = await createManualPlannedCommit(userId, input.scheduleId);
  const result = await executePlannedCommit(planned.id);
  return Response.json({ plannedCommitId: planned.id, result });
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "Use POST to run a schedule now." }, { status: 405 });
}
