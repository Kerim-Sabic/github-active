import { createClient } from "@/utils/supabase/server";

export type ProviderToken = {
  token: string;
  expiresAt: number | null;
  login: string;
  email: string | null;
  githubUserId: number | null;
  avatarUrl: string | null;
};

export async function getProviderToken(): Promise<ProviderToken | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;

    const session = data.session;
    if (!session.provider_token) return null;

    const meta = session.user.user_metadata;
    const login =
      readMetadataString(meta, "user_name") ??
      readMetadataString(meta, "preferred_username") ??
      session.user.email ??
      "github-user";

    const expiresAtRaw = (session as unknown as { provider_token_expires_at?: number }).provider_token_expires_at;
    const expiresAtSeconds = typeof expiresAtRaw === "number" ? expiresAtRaw : null;

    return {
      token: session.provider_token,
      expiresAt: expiresAtSeconds ? expiresAtSeconds * 1000 : null,
      login,
      email: session.user.email ?? null,
      githubUserId: readMetadataNumber(meta, "provider_id") ?? readMetadataNumber(meta, "sub"),
      avatarUrl: readMetadataString(meta, "avatar_url") ?? readMetadataString(meta, "picture")
    };
  } catch {
    return null;
  }
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readMetadataNumber(metadata: unknown, key: string): number | null {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
