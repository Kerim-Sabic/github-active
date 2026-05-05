import { isSupabaseConfigured, serverEnv } from "@/server/env";

type SetupEnv = typeof serverEnv;

export type SetupCheck = {
  key: string;
  label: string;
  group: "app" | "database" | "github" | "security" | "worker";
  configured: boolean;
  required: boolean;
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
  supabaseReady: boolean;
  missing: string[];
  checks: SetupCheck[];
};

export function getSetupStatus(env: SetupEnv = serverEnv): SetupStatus {
  const databaseUrl = env.NETLIFY_DATABASE_URL ?? env.DATABASE_URL ?? env.POSTGRES_URL ?? env.SUPABASE_DATABASE_URL;
  const checks: SetupCheck[] = [
    {
      key: "APP_URL",
      label: "Public app URL",
      group: "app",
      configured: isPublicUrl(env.APP_URL),
      required: true,
      requiredFor: "GitHub callback redirects"
    },
    {
      key: "NETLIFY_DATABASE_URL",
      label: "Postgres database URL",
      group: "database",
      configured: Boolean(databaseUrl),
      required: true,
      requiredFor: "users, installations, schedules, job runs; can also be DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URL"
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase project URL",
      group: "database",
      configured: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
      required: false,
      requiredFor: "manual mode helpers and future hosted session storage"
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      label: "Supabase publishable key",
      group: "database",
      configured: Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      required: false,
      requiredFor: "manual mode helpers and future hosted session storage"
    },
    {
      key: "GITHUB_APP_SLUG",
      label: "GitHub App slug",
      group: "github",
      configured: Boolean(env.GITHUB_APP_SLUG),
      required: true,
      requiredFor: "installation redirect"
    },
    {
      key: "GITHUB_APP_ID",
      label: "GitHub App ID",
      group: "github",
      configured: Boolean(env.GITHUB_APP_ID),
      required: true,
      requiredFor: "installation token JWT"
    },
    {
      key: "GITHUB_APP_CLIENT_ID",
      label: "GitHub App client ID",
      group: "github",
      configured: Boolean(env.GITHUB_APP_CLIENT_ID),
      required: true,
      requiredFor: "user authorization"
    },
    {
      key: "GITHUB_APP_CLIENT_SECRET",
      label: "GitHub App client secret",
      group: "github",
      configured: Boolean(env.GITHUB_APP_CLIENT_SECRET),
      required: true,
      requiredFor: "OAuth code exchange"
    },
    {
      key: "GITHUB_APP_PRIVATE_KEY",
      label: "GitHub App private key",
      group: "github",
      configured: Boolean(env.GITHUB_APP_PRIVATE_KEY),
      required: true,
      requiredFor: "short-lived installation tokens"
    },
    {
      key: "SESSION_SECRET",
      label: "Session signing secret",
      group: "security",
      configured: Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32),
      required: true,
      requiredFor: "signed sessions and OAuth state"
    },
    {
      key: "INTERNAL_JOB_SECRET",
      label: "Internal worker secret",
      group: "worker",
      configured: Boolean(env.INTERNAL_JOB_SECRET && env.INTERNAL_JOB_SECRET.length >= 16),
      required: true,
      requiredFor: "dispatcher to background worker calls"
    }
  ];

  const missing = checks.filter((check) => check.required && !check.configured).map((check) => check.key);
  const githubReady = checks.filter((check) => check.group === "github").every((check) => check.configured);
  const databaseReady = Boolean(databaseUrl);
  const supabaseReady = isSupabaseConfiguredForEnv(env);
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
    supabaseReady,
    missing,
    checks
  };
}

function isSupabaseConfiguredForEnv(env: SetupEnv): boolean {
  if (env === serverEnv) return isSupabaseConfigured();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
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

export function buildConnectUrl(input: {
  reason?: string;
  from?: string;
  appUrl?: string;
  missing?: readonly string[];
} = {}): string {
  const url = new URL(`${(input.appUrl ?? serverEnv.APP_URL).replace(/\/$/, "")}/connect`);
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
