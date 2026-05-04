import { getSessionUserId } from "@/server/auth/session";
import { listRepositories } from "@/server/db/repository";
import { isDatabaseConfigured } from "@/server/db/client";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Connect GitHub before listing repositories." }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Database is not configured." }, { status: 503 });

  const repositories = await listRepositories(userId);
  return Response.json({ repositories });
}
