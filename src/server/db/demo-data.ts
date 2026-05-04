import { DateTime } from "luxon";
import { type AutomationConfig } from "@/server/automation/types";
import { calculateNextRun } from "@/server/automation/scheduler";
import { generateCommit } from "@/server/automation/content-generator";

export type DashboardData = {
  user: {
    login: string;
    avatarUrl: string | null;
  };
  repositories: Array<{
    id: string;
    fullName: string;
    private: boolean;
    defaultBranch: string;
  }>;
  schedules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    repoFullName: string;
    nextRunAt: string;
    config: AutomationConfig;
  }>;
  recentRuns: Array<{
    id: string;
    status: string;
    message: string;
    createdAt: string;
  }>;
};

export function createDemoConfig(): AutomationConfig {
  return {
    repo: {
      owner: "octocat",
      name: "dev-journal",
      fullName: "octocat/dev-journal"
    },
    branch: "main",
    timezone: "Europe/Warsaw",
    activeDays: [1, 2, 3, 4, 5],
    quietHours: { start: 22, end: 7 },
    intensity: "steady",
    maxDailyCommits: 4,
    contentMix: {
      journal: 0.34,
      snippet: 0.24,
      resource: 0.16,
      config: 0.08,
      test: 0.1,
      "project-log": 0.08
    },
    tracks: ["frontend", "backend", "security"],
    catchUpPolicy: "limited",
    authorName: "Verified Developer",
    authorEmail: "developer@example.com"
  };
}

export function getDemoDashboardData(): DashboardData {
  const config = createDemoConfig();
  const nextRun = calculateNextRun(config, new Date());
  const preview = generateCommit(config, nextRun.dueAt, nextRun.idempotencyKey);

  return {
    user: {
      login: "demo-user",
      avatarUrl: null
    },
    repositories: [
      {
        id: "demo-repo",
        fullName: config.repo.fullName,
        private: false,
        defaultBranch: "main"
      }
    ],
    schedules: [
      {
        id: "demo-schedule",
        name: "Developer journal",
        enabled: true,
        repoFullName: config.repo.fullName,
        nextRunAt: nextRun.dueAt.toISOString(),
        config
      }
    ],
    recentRuns: [
      {
        id: "demo-run-1",
        status: "completed",
        message: preview.message,
        createdAt: DateTime.now().minus({ hours: 3 }).toISO() ?? new Date().toISOString()
      },
      {
        id: "demo-run-2",
        status: "queued",
        message: "Next transparent journal commit is scheduled",
        createdAt: nextRun.dueAt.toISOString()
      }
    ]
  };
}
