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

  // Always re-check with GitHub if we don't have a recorded star yet.
  // GitHub is the source of truth — once it returns 204 we record it.
  if (!supporter) {
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
    prompted: !supporter,
    persistent: true,
    starredAt: starredAt?.toISOString() ?? null,
    repo: {
      owner: PRIMARY_FEATURED_REPO.owner,
      name: PRIMARY_FEATURED_REPO.repo,
      url: `https://github.com/${PRIMARY_FEATURED_REPO.owner}/${PRIMARY_FEATURED_REPO.repo}`
    }
  });
}
