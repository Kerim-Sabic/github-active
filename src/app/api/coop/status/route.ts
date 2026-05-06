import { getProviderToken } from "@/server/auth/provider-token";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { getActiveQueueDepth, getPairStatusForUser } from "@/server/db/pair-repo";
import { getDatabase } from "@/server/db/client";
import { eq } from "drizzle-orm";
import { users as usersTable } from "@/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  const userRow = await ensureUserFromProvider(provider);
  if (!userRow) {
    return Response.json({
      configured: false,
      message: "Pair Board needs the database to be wired (set SUPABASE_DATABASE_URL)."
    });
  }

  const [status, queueDepth] = await Promise.all([
    getPairStatusForUser(userRow.id),
    getActiveQueueDepth()
  ]);

  let partner: { login: string; avatarUrl: string | null } | null = null;
  if (status.state === "matched") {
    partner = { login: status.partner.githubLogin, avatarUrl: status.partner.avatarUrl };
  } else if (status.state === "completed" && status.row.matchedWithUserId) {
    const db = getDatabase();
    if (db) {
      const partnerUser = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, status.row.matchedWithUserId))
        .limit(1);
      if (partnerUser[0]) {
        partner = { login: partnerUser[0].login, avatarUrl: partnerUser[0].avatarUrl };
      }
    }
  }

  return Response.json({
    configured: true,
    state: status.state,
    queueDepth,
    you: {
      login: provider.login,
      avatarUrl: provider.avatarUrl
    },
    partner,
    queueAhead: status.state === "waiting" ? status.queueAhead : null,
    rowId: status.state !== "none" ? status.row.id : null,
    completedAt: status.state === "completed" ? status.row.completedAt?.toISOString() : null,
    matchedAt: status.state === "matched" ? status.row.matchedAt?.toISOString() : null
  });
}
