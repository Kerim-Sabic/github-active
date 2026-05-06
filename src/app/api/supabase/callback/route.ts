import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getDatabase } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

const DEFAULT_NEXT = "/achievements?welcome=1";

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");

  let next = searchParams.get("next") ?? DEFAULT_NEXT;
  if (!next.startsWith("/")) next = DEFAULT_NEXT;

  if (errorParam) {
    return redirectFor(request, origin, "/connect", { reason: "supabase_oauth_failed", detail: errorParam.slice(0, 200) });
  }

  if (!code) {
    return redirectFor(request, origin, next);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return redirectFor(request, origin, "/connect", { reason: "supabase_exchange_failed" });
  }

  await persistUser(data.session.user);

  return redirectFor(request, origin, next);
}

function redirectFor(
  request: Request,
  origin: string,
  path: string,
  params?: Record<string, string>
): Response {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const isLocalEnv = process.env.NODE_ENV === "development";

  const base = isLocalEnv || !forwardedHost ? origin : `${forwardedProto}://${forwardedHost}`;
  const target = new URL(path, base);

  if (params) {
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  }

  return NextResponse.redirect(target);
}

async function persistUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null | undefined;
}): Promise<void> {
  const db = getDatabase();
  if (!db) return;

  const meta = user.user_metadata ?? {};
  const githubId = readNumber(meta, "provider_id") ?? readNumber(meta, "sub");
  const login = readString(meta, "user_name") ?? readString(meta, "preferred_username");
  if (!githubId || !login) return;

  try {
    await db
      .insert(users)
      .values({
        githubUserId: githubId,
        login,
        avatarUrl: readString(meta, "avatar_url") ?? readString(meta, "picture") ?? null,
        name: readString(meta, "name") ?? readString(meta, "full_name") ?? null,
        email: user.email ?? readString(meta, "email") ?? null
      })
      .onConflictDoUpdate({
        target: users.githubUserId,
        set: {
          login,
          avatarUrl: readString(meta, "avatar_url") ?? readString(meta, "picture") ?? null,
          name: readString(meta, "name") ?? readString(meta, "full_name") ?? null,
          email: user.email ?? null,
          updatedAt: sql`now()`
        }
      });
  } catch {
    // Persisting the user is best-effort; auth still works for the rest of
    // the session even if the upsert fails (e.g. database not configured).
  }
}

function readString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(meta: Record<string, unknown>, key: string): number | null {
  const value = meta[key];
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
