import { getSessionUserId } from "@/server/auth/session";
import { getDashboardData } from "@/server/db/repository";
import { getSetupStatus } from "@/server/setup/status";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  const data = await getDashboardData(userId);
  const setup = getSetupStatus();

  return <DashboardShell data={data} isDemo={!userId} setup={setup} />;
}
