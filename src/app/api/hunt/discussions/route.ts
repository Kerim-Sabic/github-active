import { getProviderToken } from "@/server/auth/provider-token";
import { searchDiscussions } from "@/server/github/discussions";
import { getUserTopLanguages } from "@/server/github/languages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const explicit = url.searchParams.get("language");
  const langs = explicit ? [explicit] : await getUserTopLanguages(provider.token, provider.login, 3);
  const effective = langs.length > 0 ? langs : ["TypeScript", "Python", "Go"];

  const discussions = await searchDiscussions({
    token: provider.token,
    languages: effective,
    perPage: 30,
    daysBack: 45
  });

  return Response.json({
    languages: effective,
    detected: explicit ? [explicit] : langs,
    discussions
  });
}
