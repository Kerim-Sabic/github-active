import { eq, sql } from "drizzle-orm";
import { getProviderToken } from "@/server/auth/provider-token";
import { getDatabase } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { hasUserStarred } from "@/server/github/star-check";
import { PRIMARY_FEATURED_REPO } from "@/server/featured-repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records that the user clicked the "Star on GitHub" button. Marks the
 * prompt dismissed so it won't reappear, and runs an immediate star-check
 * (which usually returns false because GitHub hasn't registered the action
 * yet — the rolling recheck in /api/supporter/status flips the bit later).
 */
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !origin.endsWith(host)) {
    return Response.json({ error: "cross-origin" }, { status: 403 });
  }

  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  const userRow = await ensureUserFromProvider(provider);
  const repoUrl = `https://github.com/${PRIMARY_FEATURED_REPO.owner}/${PRIMARY_FEATURED_REPO.repo}`;

  if (!userRow) {
    // No DB — the client tracks dismissal in localStorage instead.
    return Response.json({ ok: true, persistent: false, repoUrl });
  }

  const db = getDatabase();
  if (!db) return Response.json({ ok: true, persistent: false, repoUrl });

  const alreadyStarred = await hasUserStarred(
    provider.token,
    PRIMARY_FEATURED_REPO.owner,
    PRIMARY_FEATURED_REPO.repo
  );

  // Don't set supporterPromptDismissedAt here — the modal should keep
  // returning until GitHub actually confirms the star. If the user clicks
  // through but never finishes starring, the next visit re-prompts.
  if (alreadyStarred) {
    await db
      .update(users)
      .set({ starredAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(users.id, userRow.id));
  }

  return Response.json({
    ok: true,
    persistent: true,
    supporter: alreadyStarred,
    repoUrl
  });
}
