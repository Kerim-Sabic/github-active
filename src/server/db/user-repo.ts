import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/server/db/client";
import { users, type UserRow } from "@/server/db/schema";
import { type ProviderToken } from "@/server/auth/provider-token";

/**
 * Returns the users row for the active GitHub session, creating or updating
 * it if needed. Returns null if the database is not configured.
 *
 * Centralised here so feature routes (supporter, coop, showcase) don't each
 * have to duplicate the upsert + lookup dance.
 */
export async function ensureUserFromProvider(
  provider: ProviderToken
): Promise<UserRow | null> {
  const db = getDatabase();
  if (!db || !provider.githubUserId) return null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.githubUserId, provider.githubUserId))
    .limit(1);

  if (existing[0]) {
    if (existing[0].login !== provider.login || existing[0].avatarUrl !== provider.avatarUrl) {
      await db
        .update(users)
        .set({
          login: provider.login,
          avatarUrl: provider.avatarUrl ?? existing[0].avatarUrl,
          email: provider.email ?? existing[0].email,
          updatedAt: sql`now()`
        })
        .where(eq(users.id, existing[0].id));
    }
    return existing[0];
  }

  const [inserted] = await db
    .insert(users)
    .values({
      githubUserId: provider.githubUserId,
      login: provider.login,
      avatarUrl: provider.avatarUrl,
      email: provider.email
    })
    .returning();
  return inserted ?? null;
}

export async function getUserByGithubId(githubUserId: number): Promise<UserRow | null> {
  const db = getDatabase();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.githubUserId, githubUserId)).limit(1);
  return rows[0] ?? null;
}
