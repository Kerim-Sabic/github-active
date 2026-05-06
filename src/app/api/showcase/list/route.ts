import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { githubHeaders } from "@/server/github/client";
import { FEATURED_REPOS } from "@/server/featured-repos";
import { listShowcase } from "@/server/db/showcase-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RepoMetaSchema = z.object({
  full_name: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  html_url: z.string(),
  homepage: z.string().nullable().optional(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  language: z.string().nullable().optional(),
  owner: z.object({ login: z.string(), avatar_url: z.string().nullable() })
});

export type ShowcaseListResponse = {
  configured: boolean;
  featured: Array<{
    owner: string;
    repo: string;
    description: string | null;
    stars: number;
    avatarUrl: string | null;
    url: string;
    pitch: string;
  }>;
  community: Array<{
    owner: string;
    repo: string;
    description: string | null;
    homepage: string | null;
    language: string | null;
    stars: number;
    avatarUrl: string | null;
    url: string;
  }>;
};

export async function GET(): Promise<Response> {
  const provider = await getProviderToken();
  // We allow listing the showcase publicly when there's no provider — fall
  // back to unauthenticated GitHub fetches for the featured pins (low rate
  // limit, but fine for a small static list).
  const token = provider?.token ?? null;

  const featured = await Promise.all(
    FEATURED_REPOS.map(async (entry) => {
      const meta = await fetchRepoMeta(entry.owner, entry.repo, token);
      return {
        owner: entry.owner,
        repo: entry.repo,
        description: meta?.description ?? null,
        stars: meta?.stargazers_count ?? 0,
        avatarUrl: meta?.owner.avatar_url ?? null,
        url: meta?.html_url ?? `https://github.com/${entry.owner}/${entry.repo}`,
        pitch: entry.pitch
      };
    })
  );

  const rows = await listShowcase(60);
  const community = rows.map((row) => ({
    owner: row.ownerLogin,
    repo: row.repoName,
    description: row.description,
    homepage: row.homepage,
    language: row.language,
    stars: row.stargazersCount,
    avatarUrl: null,
    url: `https://github.com/${row.ownerLogin}/${row.repoName}`
  }));

  return Response.json({
    configured: rows !== null,
    featured,
    community
  } satisfies ShowcaseListResponse);
}

async function fetchRepoMeta(owner: string, repo: string, token: string | null) {
  const headers: HeadersInit = token
    ? githubHeaders(token)
    : {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-active-netlify-saas"
      };
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!response.ok) return null;
  const raw: unknown = await response.json();
  const parsed = RepoMetaSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
