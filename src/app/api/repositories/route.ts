import { getSessionUserId } from "@/server/auth/session";
import { listRepositories } from "@/server/db/repository";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  const repositories = await listRepositories(userId);
  return Response.json({ repositories });
}
