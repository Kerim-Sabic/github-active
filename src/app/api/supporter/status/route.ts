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
 * Status endpoint for the supporter prompt.
 *
 * - `prompted` true if the dismissible modal should still show.
 * - `supporter` true if GitHub confirms the user has starred the maker repo.
 * - When `dismissed` is recent and `supporter` is still false, the route does
 *   one fresh GitHub check to flip the bit as soon as the user actually stars
 *   in the GitHub tab.
 */
export async function GET(): Promise<Response> {
  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  const userRow = await ensureUserFromProvider(provider);

  if (!userRow) {
    // No DB configured — modal still works in localStorage-only mode on the
    // client. We can still answer "are you a supporter?" via GitHub directly.
    const supporter = await hasUserStarred(
      provider.token,
      PRIMARY_FEATURED_REPO.owner,
      PRIMARY_FEATURED_REPO.repo
    );
    return Response.json({
      supporter,
      prompted: !supporter,
      persistent: false
    });
  }

  let supporter = userRow.starredAt !== null;
  let starredAt = userRow.starredAt;
  const dismissed = userRow.supporterPromptDismissedAt;

  // Rolling re-check: if dismissed within the last 10 minutes and we don't
  // yet have a starredAt timestamp, ask GitHub once. This catches the case
  // where the user clicked the prompt, starred on GitHub, then came back.
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  const recentlyDismissed = dismissed && dismissed.getTime() > tenMinutesAgo;
  const shouldRecheck = !supporter && recentlyDismissed;

  if (shouldRecheck) {
    const freshlyStarred = await hasUserStarred(
      provider.token,
      PRIMARY_FEATURED_REPO.owner,
      PRIMARY_FEATURED_REPO.repo
    );
    if (freshlyStarred) {
      const db = getDatabase();
      if (db) {
        await db
          .update(users)
          .set({ starredAt: sql`now()`, updatedAt: sql`now()` })
          .where(eq(users.id, userRow.id));
      }
      supporter = true;
      starredAt = new Date();
    }
  }

  return Response.json({
    supporter,
    prompted: !supporter && !dismissed,
    persistent: true,
    starredAt: starredAt?.toISOString() ?? null,
    dismissedAt: dismissed?.toISOString() ?? null,
    repo: {
      owner: PRIMARY_FEATURED_REPO.owner,
      name: PRIMARY_FEATURED_REPO.repo,
      url: `https://github.com/${PRIMARY_FEATURED_REPO.owner}/${PRIMARY_FEATURED_REPO.repo}`
    }
  });
}
