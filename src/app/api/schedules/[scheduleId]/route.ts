import { getSessionUserId } from "@/server/auth/session";
import { patchSchedule } from "@/server/db/repository";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ scheduleId: string }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { scheduleId } = await context.params;
  const raw: unknown = await request.json();
  const schedule = await patchSchedule(userId, scheduleId, raw);
  return Response.json({ schedule });
}
