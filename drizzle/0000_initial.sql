CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "github_user_id" integer NOT NULL,
  "login" text NOT NULL,
  "avatar_url" text,
  "name" text,
  "email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_github_user_id_idx" ON "users" ("github_user_id");

CREATE TABLE IF NOT EXISTS "github_installations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "installation_id" integer NOT NULL,
  "account_login" text NOT NULL,
  "account_type" text NOT NULL,
  "repository_selection" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "github_installations_installation_id_idx" ON "github_installations" ("installation_id");

CREATE TABLE IF NOT EXISTS "repositories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "installation_db_id" uuid NOT NULL REFERENCES "github_installations"("id") ON DELETE cascade,
  "github_id" integer NOT NULL,
  "owner" text NOT NULL,
  "name" text NOT NULL,
  "full_name" text NOT NULL,
  "private" boolean DEFAULT false NOT NULL,
  "default_branch" text DEFAULT 'main' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "repositories_user_full_name_idx" ON "repositories" ("user_id", "full_name");
CREATE UNIQUE INDEX IF NOT EXISTS "repositories_github_id_idx" ON "repositories" ("github_id");

CREATE TABLE IF NOT EXISTS "automation_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "repository_id" uuid REFERENCES "repositories"("id") ON DELETE set null,
  "installation_db_id" uuid REFERENCES "github_installations"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "repo_owner" text NOT NULL,
  "repo_name" text NOT NULL,
  "branch" text DEFAULT 'main' NOT NULL,
  "config" jsonb NOT NULL,
  "next_run_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "planned_commits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "schedule_id" uuid NOT NULL REFERENCES "automation_schedules"("id") ON DELETE cascade,
  "due_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "idempotency_key" text NOT NULL,
  "generated_commit" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "planned_commits_idempotency_idx" ON "planned_commits" ("idempotency_key");

CREATE TABLE IF NOT EXISTS "job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "planned_commit_id" uuid NOT NULL REFERENCES "planned_commits"("id") ON DELETE cascade,
  "status" text NOT NULL,
  "github_sha" text,
  "github_url" text,
  "error" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "action" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
