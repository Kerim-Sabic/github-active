import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { type AutomationConfig, type GeneratedCommit } from "@/server/automation/types";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubUserId: integer("github_user_id").notNull(),
    login: text("login").notNull(),
    avatarUrl: text("avatar_url"),
    name: text("name"),
    email: text("email"),
    starredAt: timestamp("starred_at", { withTimezone: true }),
    supporterPromptDismissedAt: timestamp("supporter_prompt_dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("users_github_user_id_idx").on(table.githubUserId)]
);

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    installationId: integer("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    repositorySelection: text("repository_selection").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("github_installations_installation_id_idx").on(table.installationId)]
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    installationDbId: uuid("installation_db_id")
      .references(() => githubInstallations.id, { onDelete: "cascade" })
      .notNull(),
    githubId: integer("github_id").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    private: boolean("private").default(false).notNull(),
    defaultBranch: text("default_branch").default("main").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("repositories_user_full_name_idx").on(table.userId, table.fullName),
    uniqueIndex("repositories_github_id_idx").on(table.githubId)
  ]
);

export const automationSchedules = pgTable("automation_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  repositoryId: uuid("repository_id").references(() => repositories.id, { onDelete: "set null" }),
  installationDbId: uuid("installation_db_id").references(() => githubInstallations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  branch: text("branch").default("main").notNull(),
  config: jsonb("config").$type<AutomationConfig>().notNull(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const plannedCommits = pgTable(
  "planned_commits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    scheduleId: uuid("schedule_id").references(() => automationSchedules.id, { onDelete: "cascade" }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: text("status").default("pending").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    generatedCommit: jsonb("generated_commit").$type<GeneratedCommit>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("planned_commits_idempotency_idx").on(table.idempotencyKey)]
);

export const jobRuns = pgTable("job_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  plannedCommitId: uuid("planned_commit_id").references(() => plannedCommits.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull(),
  githubSha: text("github_sha"),
  githubUrl: text("github_url"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true })
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const pairSignups = pgTable(
  "pair_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    githubLogin: text("github_login").notNull(),
    githubUserId: integer("github_user_id").notNull(),
    avatarUrl: text("avatar_url"),
    status: text("status").default("waiting").notNull(),
    matchedWithUserId: uuid("matched_with_user_id").references(() => users.id, { onDelete: "set null" }),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    selfRanAt: timestamp("self_ran_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("pair_signups_status_idx").on(table.status),
    index("pair_signups_user_id_idx").on(table.userId)
  ]
);

export const repoShowcase = pgTable(
  "repo_showcase",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    ownerLogin: text("owner_login").notNull(),
    repoName: text("repo_name").notNull(),
    description: text("description"),
    homepage: text("homepage"),
    language: text("language"),
    stargazersCount: integer("stargazers_count").default(0).notNull(),
    forksCount: integer("forks_count").default(0).notNull(),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("repo_showcase_user_repo_idx").on(table.userId, table.ownerLogin, table.repoName),
    index("repo_showcase_recent_idx").on(table.createdAt)
  ]
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    feature: text("feature").notNull(),
    keySource: text("key_source").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    reasoningTokens: integer("reasoning_tokens").default(0).notNull(),
    bucketDay: text("bucket_day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("ai_usage_user_day_idx").on(table.userId, table.bucketDay)]
);

export type DraftFileChange = {
  path: string;
  newContent: string;
  reason?: string;
};

export type ContributionDraftPayload = {
  summary: string;
  filesToChange: DraftFileChange[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
  baseBranch: string;
  baseSha: string;
  reasoning?: string;
};

export const contributionDrafts = pgTable(
  "contribution_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    upstreamOwner: text("upstream_owner").notNull(),
    upstreamRepo: text("upstream_repo").notNull(),
    issueNumber: integer("issue_number").notNull(),
    draft: jsonb("draft").$type<ContributionDraftPayload>().notNull(),
    submittedPrUrl: text("submitted_pr_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("contribution_drafts_user_idx").on(table.userId)]
);

export type UserRow = typeof users.$inferSelect;
export type RepositoryRow = typeof repositories.$inferSelect;
export type AutomationScheduleRow = typeof automationSchedules.$inferSelect;
export type PlannedCommitRow = typeof plannedCommits.$inferSelect;
export type PairSignupRow = typeof pairSignups.$inferSelect;
export type RepoShowcaseRow = typeof repoShowcase.$inferSelect;
export type AiUsageRow = typeof aiUsage.$inferSelect;
export type ContributionDraftRow = typeof contributionDrafts.$inferSelect;
