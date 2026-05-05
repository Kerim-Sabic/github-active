import { createClient } from "@/utils/supabase/server";

export type SupabaseAuthUser = {
  id: string;
  login: string;
  avatarUrl: string | null;
  email: string | null;
};

export async function getSupabaseAuthUser(): Promise<SupabaseAuthUser | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const metadata = data.user.user_metadata;
    const login =
      readMetadataString(metadata, "user_name") ??
      readMetadataString(metadata, "preferred_username") ??
      readMetadataString(metadata, "name") ??
      data.user.email ??
      "github-user";

    return {
      id: data.user.id,
      login,
      avatarUrl: readMetadataString(metadata, "avatar_url") ?? readMetadataString(metadata, "picture"),
      email: data.user.email ?? null
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
