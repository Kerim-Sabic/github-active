import { getSessionUserId } from "@/server/auth/session";
import { getSupabaseAuthUser } from "@/server/auth/supabase-session";
import { getDashboardData } from "@/server/db/repository";
import { getSetupStatus } from "@/server/setup/status";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  const supabaseUser = userId ? null : await getSupabaseAuthUser();
  const data = await getDashboardData(userId);
  const setup = getSetupStatus();
  const displayData = supabaseUser
    ? {
        ...data,
        user: {
          login: supabaseUser.login,
          avatarUrl: supabaseUser.avatarUrl
        }
      }
    : data;

  return <DashboardShell data={displayData} isDemo={!userId} setup={setup} authMode={supabaseUser ? "supabase" : userId ? "github-app" : "demo"} />;
}
