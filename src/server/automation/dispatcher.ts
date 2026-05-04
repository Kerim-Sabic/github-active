import { planScheduleCommit, listDueSchedules } from "@/server/db/repository";
import { serverEnv } from "@/server/env";

export type DispatchResult = {
  inspected: number;
  planned: number;
  dispatched: number;
};

export async function dispatchDueSchedules(now = new Date()): Promise<DispatchResult> {
  const schedules = await listDueSchedules(now);
  let planned = 0;
  let dispatched = 0;

  for (const schedule of schedules) {
    const commit = await planScheduleCommit(schedule, now);
    if (!commit) continue;

    planned++;
    const didDispatch = await dispatchBackgroundCommit(commit.id);
    if (didDispatch) dispatched++;
  }

  return { inspected: schedules.length, planned, dispatched };
}

async function dispatchBackgroundCommit(plannedCommitId: string): Promise<boolean> {
  const url = `${serverEnv.APP_URL.replace(/\/$/, "")}/.netlify/functions/execute-commit-background`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serverEnv.INTERNAL_JOB_SECRET ? { "X-Internal-Job-Secret": serverEnv.INTERNAL_JOB_SECRET } : {})
      },
      body: JSON.stringify({ plannedCommitId })
    });

    return response.ok || response.status === 202;
  } catch {
    return false;
  }
}
