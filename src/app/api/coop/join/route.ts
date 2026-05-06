import { getProviderToken } from "@/server/auth/provider-token";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { joinPairQueue } from "@/server/db/pair-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (!userRow) {
    return Response.json({
      error: "database not configured",
      reason: "db_unavailable",
      message: "Pair Board needs SUPABASE_DATABASE_URL set on Netlify."
    }, { status: 503 });
  }
  if (!provider.githubUserId) {
    return Response.json({ error: "missing github user id on session" }, { status: 400 });
  }

  const status = await joinPairQueue({
    userId: userRow.id,
    githubLogin: provider.login,
    githubUserId: provider.githubUserId,
    avatarUrl: provider.avatarUrl
  });

  if (status.state === "matched") {
    return Response.json({
      state: "matched",
      partner: {
        login: status.partner.githubLogin,
        avatarUrl: status.partner.avatarUrl
      }
    });
  }

  return Response.json({ state: status.state });
}
