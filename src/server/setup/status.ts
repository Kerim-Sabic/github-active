import { serverEnv } from "@/server/env";

type SetupEnv = typeof serverEnv;

export type SetupCheck = {
  key: string;
  label: string;
  group: "app" | "database" | "github" | "security" | "worker";
  configured: boolean;
  requiredFor: string;
};

export type SetupStatus = {
  appUrl: string;
  ready: boolean;
  canStartGitHubAuth: boolean;
  databaseReady: boolean;
  githubReady: boolean;
  securityReady: boolean;
  workerReady: boolean;
  missing: string[];
  checks: SetupCheck[];
};

export function getSetupStatus(env: SetupEnv = serverEnv): SetupStatus {
  const databaseUrl = env.NETLIFY_DATABASE_URL ?? env.DATABASE_URL ?? env.POSTGRES_URL;
  const checks: SetupCheck[] = [
    {
      key: "APP_URL",
      label: "Public app URL",
      group: "app",
      configured: isPublicUrl(env.APP_URL),
      requiredFor: "GitHub callback redirects"
    },
    {
      key: "NETLIFY_DATABASE_URL",
      label: "Postgres database URL",
      group: "database",
      configured: Boolean(databaseUrl),
      requiredFor: "users, installations, schedules, job runs"
    },
    {
      key: "GITHUB_APP_SLUG",
      label: "GitHub App slug",
      group: "github",
      configured: Boolean(env.GITHUB_APP_SLUG),
      requiredFor: "installation redirect"
    },
    {
      key: "GITHUB_APP_ID",
      label: "GitHub App ID",
      group: "github",
      configured: Boolean(env.GITHUB_APP_ID),
      requiredFor: "installation token JWT"
    },
    {
      key: "GITHUB_APP_CLIENT_ID",
      label: "GitHub App client ID",
      group: "github",
      configured: Boolean(env.GITHUB_APP_CLIENT_ID),
      requiredFor: "user authorization"
    },
    {
      key: "GITHUB_APP_CLIENT_SECRET",
      label: "GitHub App client secret",
      group: "github",
      configured: Boolean(env.GITHUB_APP_CLIENT_SECRET),
      requiredFor: "OAuth code exchange"
    },
    {
      key: "GITHUB_APP_PRIVATE_KEY",
      label: "GitHub App private key",
      group: "github",
      configured: Boolean(env.GITHUB_APP_PRIVATE_KEY),
      requiredFor: "short-lived installation tokens"
    },
    {
      key: "SESSION_SECRET",
      label: "Session signing secret",
      group: "security",
      configured: Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32),
      requiredFor: "signed sessions and OAuth state"
    },
    {
      key: "INTERNAL_JOB_SECRET",
      label: "Internal worker secret",
      group: "worker",
      configured: Boolean(env.INTERNAL_JOB_SECRET && env.INTERNAL_JOB_SECRET.length >= 16),
      requiredFor: "dispatcher to background worker calls"
    }
  ];

  const missing = checks.filter((check) => !check.configured).map((check) => check.key);
  const githubReady = checks.filter((check) => check.group === "github").every((check) => check.configured);
  const databaseReady = checks.find((check) => check.group === "database")?.configured ?? false;
  const securityReady = checks.find((check) => check.group === "security")?.configured ?? false;
  const workerReady = checks.find((check) => check.group === "worker")?.configured ?? false;
  const appReady = checks.find((check) => check.group === "app")?.configured ?? false;

  return {
    appUrl: env.APP_URL,
    ready: missing.length === 0,
    canStartGitHubAuth: appReady && databaseReady && githubReady && securityReady,
    databaseReady,
    githubReady,
    securityReady,
    workerReady,
    missing,
    checks
  };
}

export function buildSetupUrl(input: {
  reason?: string;
  from?: string;
  appUrl?: string;
  missing?: readonly string[];
} = {}): string {
  const url = new URL(`${(input.appUrl ?? serverEnv.APP_URL).replace(/\/$/, "")}/setup`);
  if (input.reason) url.searchParams.set("reason", input.reason);
  if (input.from) url.searchParams.set("from", input.from);
  if (input.missing?.length) url.searchParams.set("missing", input.missing.join(","));
  return url.toString();
}

function isPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
