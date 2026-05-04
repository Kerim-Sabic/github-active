import { getSessionUserId } from "@/server/auth/session";
import { setSchedulePaused } from "@/server/db/repository";
import { PauseScheduleSchema } from "@/server/automation/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ scheduleId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { scheduleId } = await context.params;
  const raw: unknown = await request.json();
  const input = PauseScheduleSchema.parse(raw);
  const result = await setSchedulePaused(userId, scheduleId, input.paused);
  return Response.json({ result });
}
