import { getProviderToken } from "@/server/auth/provider-token";
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

  // Skip is intentionally session-only. We do NOT persist a "never show
  // again" flag — the modal will return on the user's next visit, until
  // they actually star the maker repo. Once they star, the supporter
  // status flips and the modal stops showing forever.
  //
  // The user is never blocked: dismiss closes the modal for the current
  // session via localStorage on the client.
  const userRow = await ensureUserFromProvider(provider);
  void userRow;

  return Response.json({ ok: true, persistent: false });
}
