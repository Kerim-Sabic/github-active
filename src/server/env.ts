import { z } from "zod";

const ServerEnvSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().optional(),
  NETLIFY_DATABASE_URL: z.string().url().optional(),
  POSTGRES_URL: z.string().url().optional(),
  SUPABASE_DATABASE_URL: z.string().url().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_CLIENT_ID: z.string().optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  INTERNAL_JOB_SECRET: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  OPENAI_API_KEY_MAINTAINER: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_MAINTAINER_DAILY_QUOTA: z.coerce.number().int().positive().optional(),
  NODE_ENV: z.string().optional()
});

export const serverEnv = ServerEnvSchema.parse({
  APP_URL: process.env.APP_URL ?? process.env.URL ?? "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL,
  NETLIFY_DATABASE_URL: process.env.NETLIFY_DATABASE_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
  INTERNAL_JOB_SECRET: process.env.INTERNAL_JOB_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  OPENAI_API_KEY_MAINTAINER: process.env.OPENAI_API_KEY_MAINTAINER,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_MAINTAINER_DAILY_QUOTA: process.env.OPENAI_MAINTAINER_DAILY_QUOTA,
  NODE_ENV: process.env.NODE_ENV
});

export function getDatabaseUrl(): string | null {
  return (
    serverEnv.NETLIFY_DATABASE_URL ??
    serverEnv.DATABASE_URL ??
    serverEnv.POSTGRES_URL ??
    serverEnv.SUPABASE_DATABASE_URL ??
    null
  );
}

export function getGithubPrivateKey(): string | null {
  if (!serverEnv.GITHUB_APP_PRIVATE_KEY) return null;
  return serverEnv.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");
}

export function requireEnv(value: string | undefined, name: string): string {
  if (value) return value;
  throw new Error(`${name} is required for this operation.`);
}

export function isProduction(): boolean {
  return serverEnv.NODE_ENV === "production";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(serverEnv.NEXT_PUBLIC_SUPABASE_URL && serverEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
