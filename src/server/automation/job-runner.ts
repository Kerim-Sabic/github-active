import {
  claimPlannedCommit,
  completePlannedCommit,
  failPlannedCommit,
  getRunnableCommit
} from "@/server/db/repository";
import { createOrUpdateRepositoryFile, getInstallationToken } from "@/server/github/client";

export async function executePlannedCommit(plannedCommitId: string): Promise<{ status: "completed" | "skipped"; sha?: string }> {
  const runnable = await getRunnableCommit(plannedCommitId);
  const claimed = await claimPlannedCommit(plannedCommitId);
  if (!claimed) return { status: "skipped" };

  try {
    const token = await getInstallationToken(runnable.installationId);
    const result = await createOrUpdateRepositoryFile({
      installationToken: token,
      owner: runnable.schedule.repoOwner,
      repo: runnable.schedule.repoName,
      branch: runnable.schedule.branch,
      commit: runnable.plannedCommit.generatedCommit,
      authorName: runnable.schedule.config.authorName,
      authorEmail: runnable.schedule.config.authorEmail
    });

    await completePlannedCommit(runnable.plannedCommit.userId, plannedCommitId, result.sha, result.htmlUrl);
    return { status: "completed", sha: result.sha };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown job failure";
    await failPlannedCommit(runnable.plannedCommit.userId, plannedCommitId, message);
    throw error;
  }
}
