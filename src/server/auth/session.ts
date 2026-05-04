import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { isProduction, serverEnv } from "@/server/env";

const SessionPayloadSchema = z.object({
  userId: z.string().uuid(),
  issuedAt: z.number().int(),
  expiresAt: z.number().int()
});

type SessionPayload = z.infer<typeof SessionPayloadSchema>;

export const sessionCookieName = "github_active_session";
export const oauthStateCookieName = "github_active_oauth_state";

export function createSessionToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId,
    issuedAt: now,
    expiresAt: now + 60 * 60 * 24 * 30
  };
  return createSignedToken(payload);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;
  return readSessionToken(token)?.userId ?? null;
}

export function readSessionToken(token: string): SessionPayload | null {
  const parsed = readSignedToken(token, SessionPayloadSchema);
  if (!parsed) return null;
  if (parsed.expiresAt < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

export function createSignedToken(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readSignedToken<T>(token: string, schema: z.ZodType<T>): T | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!isValidSignature(encoded, signature)) return null;

  try {
    const raw: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function buildSessionCookie(token: string): string {
  return [
    `${sessionCookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000",
    isProduction() ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildOAuthStateCookie(state: string): string {
  return [
    `${oauthStateCookieName}=${state}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    isProduction() ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearOAuthStateCookie(): string {
  return `${oauthStateCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction() ? "; Secure" : ""}`;
}

function sign(value: string): string {
  const secret = serverEnv.SESSION_SECRET ?? "github-active-local-session-secret-change-before-production";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function isValidSignature(encoded: string, signature: string): boolean {
  const expected = Buffer.from(sign(encoded), "utf8");
  const received = Buffer.from(signature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
