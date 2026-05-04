import { and, desc, eq, lte } from "drizzle-orm";
import { calculateNextRun, shouldCatchUp } from "@/server/automation/scheduler";
import { generateCommit } from "@/server/automation/content-generator";
import {
  type AutomationConfig,
  ScheduleInputSchema,
  PatchScheduleSchema
} from "@/server/automation/types";
import { getDatabase } from "./client";
import {
  auditEvents,
  automationSchedules,
  githubInstallations,
  jobRuns,
  plannedCommits,
  repositories,
  users,
  type AutomationScheduleRow,
  type PlannedCommitRow
} from "./schema";
import { getDemoDashboardData, type DashboardData } from "./demo-data";

export type GitHubUserInput = {
  githubUserId: number;
  login: string;
  avatarUrl: string | null;
  name: string | null;
  email: string | null;
};

export type GitHubInstallationInput = {
  userId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
};

export type GitHubRepositoryInput = {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
};

export type RunnableCommit = {
  plannedCommit: PlannedCommitRow;
  schedule: AutomationScheduleRow;
  installationId: number;
};

export async function getDashboardData(userId: string | null): Promise<DashboardData> {
  const db = getDatabase();
  if (!db || !userId) return getDemoDashboardData();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return getDemoDashboardData();

  const repoRows = await db.select().from(repositories).where(eq(repositories.userId, userId)).limit(12);
  const scheduleRows = await db
    .select()
    .from(automationSchedules)
    .where(eq(automationSchedules.userId, userId))
    .orderBy(desc(automationSchedules.createdAt))
    .limit(8);
  const runRows = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.userId, userId))
    .orderBy(desc(jobRuns.startedAt))
    .limit(8);

  return {
    user: {
      login: user.login,
      avatarUrl: user.avatarUrl
    },
    repositories: repoRows.map((repo) => ({
      id: repo.id,
      fullName: repo.fullName,
      private: repo.private,
      defaultBranch: repo.defaultBranch
    })),
    schedules: scheduleRows.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      enabled: schedule.enabled,
      repoFullName: `${schedule.repoOwner}/${schedule.repoName}`,
      nextRunAt: schedule.nextRunAt.toISOString(),
      config: schedule.config
    })),
    recentRuns: runRows.map((run) => ({
      id: run.id,
      status: run.status,
      message: run.githubSha ? `Committed ${run.githubSha.slice(0, 7)}` : run.error ?? "Queued job",
      createdAt: run.startedAt.toISOString()
    }))
  };
}

export async function upsertGitHubUser(input: GitHubUserInput): Promise<string> {
  const db = requireDatabase();
  const [row] = await db
    .insert(users)
    .values({
      githubUserId: input.githubUserId,
      login: input.login,
      avatarUrl: input.avatarUrl,
      name: input.name,
      email: input.email,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: users.githubUserId,
      set: {
        login: input.login,
        avatarUrl: input.avatarUrl,
        name: input.name,
        email: input.email,
        updatedAt: new Date()
      }
    })
    .returning({ id: users.id });

  if (!row) throw new Error("Failed to store GitHub user.");
  return row.id;
}

export async function upsertGitHubInstallation(input: GitHubInstallationInput): Promise<string> {
  const db = requireDatabase();
  const [row] = await db
    .insert(githubInstallations)
    .values({
      userId: input.userId,
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      repositorySelection: input.repositorySelection,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: githubInstallations.installationId,
      set: {
        userId: input.userId,
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        repositorySelection: input.repositorySelection,
        updatedAt: new Date()
      }
    })
    .returning({ id: githubInstallations.id });

  if (!row) throw new Error("Failed to store GitHub installation.");
  return row.id;
}

export async function replaceInstallationRepositories(
  userId: string,
  installationDbId: string,
  repoInputs: readonly GitHubRepositoryInput[]
): Promise<void> {
  const db = requireDatabase();

  for (const repo of repoInputs) {
    await db
      .insert(repositories)
      .values({
        userId,
        installationDbId,
        githubId: repo.githubId,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        private: repo.private,
        defaultBranch: repo.defaultBranch,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: repositories.githubId,
        set: {
          userId,
          installationDbId,
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
          private: repo.private,
          defaultBranch: repo.defaultBranch,
          updatedAt: new Date()
        }
      });
  }
}

export async function listRepositories(userId: string | null): Promise<DashboardData["repositories"]> {
  const db = getDatabase();
  if (!db || !userId) return getDemoDashboardData().repositories;

  const rows = await db.select().from(repositories).where(eq(repositories.userId, userId));
  return rows.map((repo) => ({
    id: repo.id,
    fullName: repo.fullName,
    private: repo.private,
    defaultBranch: repo.defaultBranch
  }));
}

export async function createSchedule(userId: string, rawInput: unknown): Promise<{ id: string; nextRunAt: string }> {
  const input = ScheduleInputSchema.parse(rawInput);
  const db = requireDatabase();
  const nextRun = calculateNextRun(input.config, new Date());
  const [row] = await db
    .insert(automationSchedules)
    .values({
      userId,
      repositoryId: input.repositoryId,
      installationDbId: input.installationId,
      name: input.name,
      repoOwner: input.config.repo.owner,
      repoName: input.config.repo.name,
      branch: input.config.branch,
      config: input.config,
      nextRunAt: nextRun.dueAt
    })
    .returning({ id: automationSchedules.id, nextRunAt: automationSchedules.nextRunAt });

  if (!row) throw new Error("Failed to create schedule.");
  await writeAudit(userId, "schedule.created", "schedule", row.id, { repo: input.config.repo.fullName });
  return { id: row.id, nextRunAt: row.nextRunAt.toISOString() };
}

export async function patchSchedule(
  userId: string,
  scheduleId: string,
  rawInput: unknown
): Promise<{ id: string; enabled: boolean; nextRunAt: string }> {
  const input = PatchScheduleSchema.parse(rawInput);
  const db = requireDatabase();
  const current = await getScheduleForUser(userId, scheduleId);
  const config = input.config ?? current.config;
  const nextRun = calculateNextRun(config, new Date());
  const [row] = await db
    .update(automationSchedules)
    .set({
      name: input.name ?? current.name,
      enabled: input.enabled ?? current.enabled,
      config,
      branch: config.branch,
      repoOwner: config.repo.owner,
      repoName: config.repo.name,
      nextRunAt: nextRun.dueAt,
      updatedAt: new Date()
    })
    .where(and(eq(automationSchedules.id, scheduleId), eq(automationSchedules.userId, userId)))
    .returning({
      id: automationSchedules.id,
      enabled: automationSchedules.enabled,
      nextRunAt: automationSchedules.nextRunAt
    });

  if (!row) throw new Error("Failed to update schedule.");
  await writeAudit(userId, "schedule.updated", "schedule", row.id, { enabled: row.enabled });
  return { id: row.id, enabled: row.enabled, nextRunAt: row.nextRunAt.toISOString() };
}

export async function setSchedulePaused(userId: string, scheduleId: string, paused: boolean): Promise<{ enabled: boolean }> {
  const db = requireDatabase();
  const [row] = await db
    .update(automationSchedules)
    .set({ enabled: !paused, updatedAt: new Date() })
    .where(and(eq(automationSchedules.id, scheduleId), eq(automationSchedules.userId, userId)))
    .returning({ enabled: automationSchedules.enabled });

  if (!row) throw new Error("Schedule not found.");
  await writeAudit(userId, paused ? "schedule.paused" : "schedule.resumed", "schedule", scheduleId, {});
  return { enabled: row.enabled };
}

export async function createManualPlannedCommit(userId: string, scheduleId: string): Promise<PlannedCommitRow> {
  const schedule = await getScheduleForUser(userId, scheduleId);
  const dueAt = new Date();
  const key = `${schedule.id}:manual:${dueAt.toISOString()}`;
  return createPlannedCommit(schedule, dueAt, key);
}

export async function listDueSchedules(now: Date): Promise<AutomationScheduleRow[]> {
  const db = requireDatabase();
  return db
    .select()
    .from(automationSchedules)
    .where(and(eq(automationSchedules.enabled, true), lte(automationSchedules.nextRunAt, now)))
    .limit(25);
}

export async function planScheduleCommit(schedule: AutomationScheduleRow, now: Date): Promise<PlannedCommitRow | null> {
  if (!shouldCatchUp(schedule.config, schedule.nextRunAt, now)) {
    await updateScheduleNextRun(schedule, now);
    return null;
  }

  const nextRun = calculateNextRun(schedule.config, schedule.nextRunAt);
  const planned = await createPlannedCommit(schedule, schedule.nextRunAt, nextRun.idempotencyKey);
  await updateScheduleNextRun(schedule, now);
  return planned;
}

export async function getRunnableCommit(plannedCommitId: string): Promise<RunnableCommit> {
  const db = requireDatabase();
  const [planned] = await db.select().from(plannedCommits).where(eq(plannedCommits.id, plannedCommitId)).limit(1);
  if (!planned) throw new Error("Planned commit not found.");

  const [schedule] = await db.select().from(automationSchedules).where(eq(automationSchedules.id, planned.scheduleId)).limit(1);
  if (!schedule) throw new Error("Schedule not found for planned commit.");

  const [installation] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.id, schedule.installationDbId ?? "00000000-0000-0000-0000-000000000000"))
    .limit(1);
  if (!installation) throw new Error("GitHub installation not found for schedule.");

  return { plannedCommit: planned, schedule, installationId: installation.installationId };
}

export async function claimPlannedCommit(plannedCommitId: string): Promise<boolean> {
  const db = requireDatabase();
  const rows = await db
    .update(plannedCommits)
    .set({ status: "running", updatedAt: new Date() })
    .where(and(eq(plannedCommits.id, plannedCommitId), eq(plannedCommits.status, "pending")))
    .returning({ id: plannedCommits.id });

  return rows.length === 1;
}

export async function completePlannedCommit(
  userId: string,
  plannedCommitId: string,
  githubSha: string,
  githubUrl: string
): Promise<void> {
  const db = requireDatabase();
  await db.update(plannedCommits).set({ status: "completed", updatedAt: new Date() }).where(eq(plannedCommits.id, plannedCommitId));
  await db.insert(jobRuns).values({
    userId,
    plannedCommitId,
    status: "completed",
    githubSha,
    githubUrl,
    finishedAt: new Date()
  });
}

export async function failPlannedCommit(userId: string, plannedCommitId: string, error: string): Promise<void> {
  const db = requireDatabase();
  await db.update(plannedCommits).set({ status: "failed", updatedAt: new Date() }).where(eq(plannedCommits.id, plannedCommitId));
  await db.insert(jobRuns).values({
    userId,
    plannedCommitId,
    status: "failed",
    error,
    finishedAt: new Date()
  });
}

async function getScheduleForUser(userId: string, scheduleId: string): Promise<AutomationScheduleRow> {
  const db = requireDatabase();
  const [schedule] = await db
    .select()
    .from(automationSchedules)
    .where(and(eq(automationSchedules.id, scheduleId), eq(automationSchedules.userId, userId)))
    .limit(1);

  if (!schedule) throw new Error("Schedule not found.");
  return schedule;
}

async function createPlannedCommit(
  schedule: AutomationScheduleRow,
  dueAt: Date,
  idempotencyKey: string
): Promise<PlannedCommitRow> {
  const db = requireDatabase();
  const generatedCommit = generateCommit(schedule.config, dueAt, idempotencyKey);
  const [row] = await db
    .insert(plannedCommits)
    .values({
      userId: schedule.userId,
      scheduleId: schedule.id,
      dueAt,
      idempotencyKey,
      generatedCommit
    })
    .onConflictDoNothing({ target: plannedCommits.idempotencyKey })
    .returning();

  if (row) return row;

  const [existing] = await db.select().from(plannedCommits).where(eq(plannedCommits.idempotencyKey, idempotencyKey)).limit(1);
  if (!existing) throw new Error("Failed to create or load planned commit.");
  return existing;
}

async function updateScheduleNextRun(schedule: AutomationScheduleRow, now: Date): Promise<void> {
  const db = requireDatabase();
  const next = calculateNextRun(schedule.config, now);
  await db
    .update(automationSchedules)
    .set({ nextRunAt: next.dueAt, updatedAt: new Date() })
    .where(eq(automationSchedules.id, schedule.id));
}

async function writeAudit(
  userId: string,
  action: string,
  subjectType: string,
  subjectId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const db = getDatabase();
  if (!db) return;
  await db.insert(auditEvents).values({ userId, action, subjectType, subjectId, metadata });
}

function requireDatabase() {
  const db = getDatabase();
  if (!db) throw new Error("Database is not configured. Set NETLIFY_DATABASE_URL or DATABASE_URL.");
  return db;
}
