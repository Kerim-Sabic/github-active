import { getSessionUserId } from "@/server/auth/session";
import { createSchedule } from "@/server/db/repository";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Connect GitHub before creating schedules." }, { status: 401 });

  const raw: unknown = await request.json();
  const schedule = await createSchedule(userId, raw);
  return Response.json({ schedule }, { status: 201 });
}
