import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { githubHeaders } from "@/server/github/client";
import { FEATURED_OWNERS, FEATURED_PER_OWNER, PRIMARY_FEATURED_REPO } from "@/server/featured-repos";
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
  fork: z.boolean().optional(),
  archived: z.boolean().optional(),
  owner: z.object({ login: z.string(), avatar_url: z.string().nullable() })
});

const RepoListSchema = z.array(RepoMetaSchema);

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

  // Resolve the primary featured repo (always pinned first) plus any
  // additional public repos owned by FEATURED_OWNERS, sorted by stars.
  const ownerListings = await Promise.all(
    FEATURED_OWNERS.map(async (owner) => {
      const repos = await fetchOwnerRepos(owner, token);
      return repos.slice(0, FEATURED_PER_OWNER + 4);
    })
  );

  const allRepos = ownerListings.flat();

  const primaryMeta =
    allRepos.find(
      (r) =>
        r.owner.login.toLowerCase() === PRIMARY_FEATURED_REPO.owner.toLowerCase() &&
        r.name.toLowerCase() === PRIMARY_FEATURED_REPO.repo.toLowerCase()
    ) ?? (await fetchRepoMeta(PRIMARY_FEATURED_REPO.owner, PRIMARY_FEATURED_REPO.repo, token));

  const featured: ReturnType<typeof toFeaturedEntry>[] = [];
  const seen = new Set<string>();

  if (primaryMeta) {
    const entry = toFeaturedEntry(primaryMeta, PRIMARY_FEATURED_REPO.pitch);
    featured.push(entry);
    seen.add(`${entry.owner}/${entry.repo}`.toLowerCase());
  }

  const others = allRepos
    .filter((r) => {
      if (r.fork || r.archived) return false;
      const key = `${r.owner.login}/${r.name}`.toLowerCase();
      if (seen.has(key)) return false;
      return true;
    })
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, FEATURED_PER_OWNER - featured.length);

  for (const meta of others) {
    featured.push(toFeaturedEntry(meta));
    seen.add(`${meta.owner.login}/${meta.name}`.toLowerCase());
  }

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
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders(token) });
  if (!response.ok) return null;
  const raw: unknown = await response.json();
  const parsed = RepoMetaSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function fetchOwnerRepos(owner: string, token: string | null): Promise<Array<z.infer<typeof RepoMetaSchema>>> {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&type=owner&sort=updated`,
    { headers: ghHeaders(token) }
  );
  if (!response.ok) return [];
  const raw: unknown = await response.json();
  const parsed = RepoListSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

function ghHeaders(token: string | null): HeadersInit {
  return token
    ? githubHeaders(token)
    : {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-active-netlify-saas"
      };
}

function toFeaturedEntry(
  meta: z.infer<typeof RepoMetaSchema>,
  pitchOverride?: string
): {
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  avatarUrl: string | null;
  url: string;
  pitch: string;
} {
  return {
    owner: meta.owner.login,
    repo: meta.name,
    description: meta.description,
    stars: meta.stargazers_count,
    avatarUrl: meta.owner.avatar_url,
    url: meta.html_url,
    pitch: pitchOverride ?? meta.description ?? `Open source by @${meta.owner.login}.`
  };
}
