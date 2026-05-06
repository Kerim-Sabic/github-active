import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { githubHeaders } from "@/server/github/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReposSchema = z.array(
  z.object({
    name: z.string(),
    full_name: z.string(),
    private: z.boolean(),
    fork: z.boolean(),
    description: z.string().nullable(),
    stargazers_count: z.number(),
    language: z.string().nullable().optional(),
    owner: z.object({ login: z.string() })
  })
);

export async function GET(): Promise<Response> {
  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  const response = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner&visibility=public",
    { headers: githubHeaders(provider.token) }
  );
  if (!response.ok) {
    return Response.json({ error: `github request failed (${response.status})` }, { status: 502 });
  }

  const raw: unknown = await response.json();
  const parsed = ReposSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "github returned unexpected shape" }, { status: 502 });
  }

  const repos = parsed.data
    .filter((r) => !r.private && !r.fork)
    .map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      fullName: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      language: r.language ?? null
    }));

  return Response.json({ repos });
}
