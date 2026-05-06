import { eq, sql } from "drizzle-orm";
import { getProviderToken } from "@/server/auth/provider-token";
import { getDatabase } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { ensureUserFromProvider } from "@/server/db/user-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records that the user dismissed the supporter prompt without clicking
 * the star button. The modal will not reappear.
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
  if (!userRow) return Response.json({ ok: true, persistent: false });

  const db = getDatabase();
  if (!db) return Response.json({ ok: true, persistent: false });

  await db
    .update(users)
    .set({
      supporterPromptDismissedAt: sql`now()`,
      updatedAt: sql`now()`
    })
    .where(eq(users.id, userRow.id));

  return Response.json({ ok: true, persistent: true });
}
