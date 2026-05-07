-- Phase 2 — Co-op + Supporter prompt
-- Apply with: psql "$SUPABASE_DATABASE_URL" -f drizzle/0001_coop.sql
-- Idempotent: re-running this migration is safe.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS starred_at timestamptz,
  ADD COLUMN IF NOT EXISTS supporter_prompt_dismissed_at timestamptz;

CREATE TABLE IF NOT EXISTS pair_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_login text NOT NULL,
  github_user_id integer NOT NULL,
  avatar_url text,
  status text NOT NULL DEFAULT 'waiting',
  matched_with_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  matched_at timestamptz,
  completed_at timestamptz,
  self_ran_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: tolerate older 0001 migrations that didn't have self_ran_at.
ALTER TABLE pair_signups ADD COLUMN IF NOT EXISTS self_ran_at timestamptz;

CREATE INDEX IF NOT EXISTS pair_signups_status_idx ON pair_signups(status);
CREATE INDEX IF NOT EXISTS pair_signups_user_id_idx ON pair_signups(user_id);

-- Only one active queue entry per user (waiting or matched).
CREATE UNIQUE INDEX IF NOT EXISTS pair_signups_active_user_idx
  ON pair_signups(user_id)
  WHERE status IN ('waiting', 'matched');

CREATE TABLE IF NOT EXISTS repo_showcase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_login text NOT NULL,
  repo_name text NOT NULL,
  description text,
  homepage text,
  language text,
  stargazers_count integer NOT NULL DEFAULT 0,
  forks_count integer NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS repo_showcase_user_repo_idx
  ON repo_showcase(user_id, owner_login, repo_name);

CREATE INDEX IF NOT EXISTS repo_showcase_recent_idx ON repo_showcase(created_at DESC);
