import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { githubHeaders } from "@/server/github/client";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { addShowcaseEntry } from "@/server/db/showcase-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InputSchema = z.object({
  owner: z.string().trim().min(1).max(80),
  repo: z.string().trim().min(1).max(120)
});

const RepoSchema = z.object({
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  homepage: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  private: z.boolean(),
  owner: z.object({ login: z.string() })
});

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

  let body: z.infer<typeof InputSchema>;
  try {
    const raw = (await request.json()) as unknown;
    body = InputSchema.parse(raw);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "bad input" }, { status: 400 });
  }

  // Only allow showcasing repos owned by the signed-in user (their personal
  // namespace). Org repos can be added by editing this check later.
  if (body.owner.toLowerCase() !== provider.login.toLowerCase()) {
    return Response.json({
      error: "you can only showcase repos you own",
      reason: "not_owner"
    }, { status: 403 });
  }

  const userRow = await ensureUserFromProvider(provider);
  if (!userRow) {
    return Response.json({ error: "database not configured", reason: "db_unavailable" }, { status: 503 });
  }

  const repoResponse = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(body.owner)}/${encodeURIComponent(body.repo)}`,
    { headers: githubHeaders(provider.token) }
  );

  if (!repoResponse.ok) {
    return Response.json({ error: "repo not found or not accessible" }, { status: 404 });
  }

  const raw: unknown = await repoResponse.json();
  const parsed = RepoSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "github returned an unexpected shape" }, { status: 502 });
  }

  if (parsed.data.private) {
    return Response.json({ error: "showcase requires a public repository" }, { status: 400 });
  }

  const inserted = await addShowcaseEntry({
    userId: userRow.id,
    ownerLogin: parsed.data.owner.login,
    repoName: parsed.data.name,
    description: parsed.data.description,
    homepage: parsed.data.homepage ?? null,
    language: parsed.data.language ?? null,
    stargazersCount: parsed.data.stargazers_count,
    forksCount: parsed.data.forks_count
  });

  return Response.json({ ok: true, entry: inserted });
}
