import { describe, expect, it } from "vitest";
import { getSetupStatus } from "@/server/setup/status";

const completeEnv = {
  APP_URL: "https://githubactive.netlify.app",
  DATABASE_URL: undefined,
  NETLIFY_DATABASE_URL: "postgres://user:pass@example.com:5432/db",
  POSTGRES_URL: undefined,
  GITHUB_APP_ID: "123456",
  GITHUB_APP_CLIENT_ID: "Iv1.client",
  GITHUB_APP_CLIENT_SECRET: "secret",
  GITHUB_APP_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\nkey\\n-----END RSA PRIVATE KEY-----",
  GITHUB_APP_SLUG: "github-active",
  INTERNAL_JOB_SECRET: "1234567890123456",
  SESSION_SECRET: "12345678901234567890123456789012",
  NODE_ENV: "production"
};

describe("setup status", () => {
  it("reports readiness without exposing secret values", () => {
    const status = getSetupStatus(completeEnv);

    expect(status.ready).toBe(true);
    expect(status.canStartGitHubAuth).toBe(true);
    expect(JSON.stringify(status)).not.toContain("12345678901234567890123456789012");
    expect(status.checks.every((check) => typeof check.configured === "boolean")).toBe(true);
  });

  it("treats Supabase helper keys as optional database checks", () => {
    const status = getSetupStatus(completeEnv);

    expect(status.ready).toBe(true);
    expect(status.supabaseReady).toBe(false);
    expect(status.missing).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(status.missing).not.toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("accepts a direct Supabase Postgres URL for the required database", () => {
    const status = getSetupStatus({
      ...completeEnv,
      NETLIFY_DATABASE_URL: undefined,
      SUPABASE_DATABASE_URL: "postgres://user:pass@db.example.supabase.co:5432/postgres"
    });

    expect(status.ready).toBe(true);
    expect(status.databaseReady).toBe(true);
    expect(status.missing).not.toContain("NETLIFY_DATABASE_URL");
  });

  it("reports exact missing deployment keys", () => {
    const status = getSetupStatus({
      ...completeEnv,
      GITHUB_APP_SLUG: undefined,
      NETLIFY_DATABASE_URL: undefined,
      SESSION_SECRET: undefined
    });

    expect(status.ready).toBe(false);
    expect(status.canStartGitHubAuth).toBe(false);
    expect(status.missing).toEqual(expect.arrayContaining(["GITHUB_APP_SLUG", "NETLIFY_DATABASE_URL", "SESSION_SECRET"]));
  });
});
