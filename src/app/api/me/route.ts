import { getSessionUserId } from "@/server/auth/session";
import { getSupabaseAuthUser } from "@/server/auth/supabase-session";
import { getDashboardData } from "@/server/db/repository";
import { isDatabaseConfigured } from "@/server/db/client";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  const supabaseUser = userId ? null : await getSupabaseAuthUser();
  const data = await getDashboardData(userId);

  return Response.json({
    authenticated: Boolean(userId || supabaseUser),
    authMode: userId ? "github-app" : supabaseUser ? "supabase" : "demo",
    supabaseUser,
    databaseConfigured: isDatabaseConfigured(),
    data
  });
}
