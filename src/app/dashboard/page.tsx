import { getSessionUserId } from "@/server/auth/session";
import { getDashboardData } from "@/server/db/repository";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  const data = await getDashboardData(userId);

  return <DashboardShell data={data} isDemo={!userId} />;
}
