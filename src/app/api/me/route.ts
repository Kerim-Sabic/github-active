import { getSessionUserId } from "@/server/auth/session";
import { getDashboardData } from "@/server/db/repository";
import { isDatabaseConfigured } from "@/server/db/client";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  const data = await getDashboardData(userId);

  return Response.json({
    authenticated: Boolean(userId),
    databaseConfigured: isDatabaseConfigured(),
    data
  });
}
