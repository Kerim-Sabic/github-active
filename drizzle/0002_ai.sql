-- Phase 3 — AI-assisted contribution wizard + Galaxy Brain Hunter
-- Apply with: psql "$SUPABASE_DATABASE_URL" -f drizzle/0002_ai.sql
-- Idempotent: re-running this migration is safe.

CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  key_source text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  reasoning_tokens integer NOT NULL DEFAULT 0,
  bucket_day text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_day_idx ON ai_usage(user_id, bucket_day);

CREATE TABLE IF NOT EXISTS contribution_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upstream_owner text NOT NULL,
  upstream_repo text NOT NULL,
  issue_number integer NOT NULL,
  draft jsonb NOT NULL,
  submitted_pr_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contribution_drafts_user_idx ON contribution_drafts(user_id);
