import {
  boolean,
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

export type UserRow = typeof users.$inferSelect;
export type RepositoryRow = typeof repositories.$inferSelect;
export type AutomationScheduleRow = typeof automationSchedules.$inferSelect;
export type PlannedCommitRow = typeof plannedCommits.$inferSelect;
