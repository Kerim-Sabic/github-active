import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { githubHeaders } from "@/server/github/client";
import { getUserTopLanguages } from "@/server/github/languages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SearchSchema = z.object({
  total_count: z.number(),
  items: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      html_url: z.string(),
      url: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      comments: z.number(),
      labels: z.array(z.object({ name: z.string() })),
      repository_url: z.string(),
      assignee: z.unknown().nullable().optional(),
      pull_request: z.unknown().optional(),
      body: z.string().nullable().optional(),
      user: z.object({ login: z.string() })
    })
  )
});

const RepoMetaSchema = z.object({
  full_name: z.string(),
  owner: z.object({ login: z.string(), avatar_url: z.string().nullable() }),
  name: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  language: z.string().nullable().optional(),
  archived: z.boolean(),
  default_branch: z.string()
});

export type ContributeIssue = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  body: string;
  labels: string[];
  comments: number;
  ageDays: number;
  repo_stars: number;
  repo_language: string | null;
  repo_description: string | null;
  repo_avatar: string | null;
};

export async function GET(request: Request): Promise<Response> {
  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const explicitLang = url.searchParams.get("language");
  const langs = explicitLang ? [explicitLang] : await getUserTopLanguages(provider.token, provider.login, 3);
  const effectiveLangs = langs.length > 0 ? langs : ["TypeScript", "JavaScript", "Python"];

  const all: ContributeIssue[] = [];
  // Run language searches in parallel; fewer results per language so we
  // get diversity instead of one big bucket.
  const perLang = 12;
  const results = await Promise.all(
    effectiveLangs.map(async (lang) => {
      const q = [
        "is:issue",
        "is:open",
        "no:assignee",
        `language:${quote(lang)}`,
        '(label:"good first issue" OR label:"help wanted")'
      ].join(" ");
      const search = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${perLang}`,
        { headers: githubHeaders(provider.token) }
      );
      if (!search.ok) return [];
      const raw: unknown = await search.json();
      const parsed = SearchSchema.safeParse(raw);
      if (!parsed.success) return [];
      return parsed.data.items.filter((item) => !item.pull_request);
    })
  );

  // Hydrate repo metadata for each unique repo (cap to N to control rate limit).
  const uniqueRepoUrls = Array.from(
    new Set(results.flatMap((items) => items.map((i) => i.repository_url)))
  ).slice(0, 30);

  const repoMetas = new Map<string, z.infer<typeof RepoMetaSchema>>();
  await Promise.all(
    uniqueRepoUrls.map(async (repoUrl) => {
      const r = await fetch(repoUrl, { headers: githubHeaders(provider.token) });
      if (!r.ok) return;
      const raw: unknown = await r.json();
      const parsed = RepoMetaSchema.safeParse(raw);
      if (parsed.success) repoMetas.set(repoUrl, parsed.data);
    })
  );

  for (const items of results) {
    for (const item of items) {
      const meta = repoMetas.get(item.repository_url);
      if (!meta) continue;
      if (meta.archived) continue;
      if (meta.stargazers_count < 25) continue;
      if (item.assignee) continue;

      const ageDays = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (24 * 60 * 60 * 1000));
      // Drop very stale issues with no engagement.
      if (ageDays > 120 && item.comments === 0) continue;

      all.push({
        owner: meta.owner.login,
        repo: meta.name,
        number: item.number,
        title: item.title,
        url: item.html_url,
        body: (item.body ?? "").slice(0, 1500),
        labels: item.labels.map((l) => l.name),
        comments: item.comments,
        ageDays,
        repo_stars: meta.stargazers_count,
        repo_language: meta.language ?? null,
        repo_description: meta.description,
        repo_avatar: meta.owner.avatar_url
      });
    }
  }

  // Rank: prefer recent + medium star count + low comment count (fresh tasks).
  all.sort((a, b) => rank(b) - rank(a));

  return Response.json({
    languages: effectiveLangs,
    detected: explicitLang ? [explicitLang] : langs,
    issues: all.slice(0, 30)
  });
}

function rank(issue: ContributeIssue): number {
  const recencyScore = Math.max(0, 60 - issue.ageDays);
  const starScore = Math.min(30, Math.log10(issue.repo_stars + 1) * 8);
  const freshnessScore = issue.comments === 0 ? 5 : issue.comments < 3 ? 2 : 0;
  return recencyScore + starScore + freshnessScore;
}

function quote(s: string): string {
  if (/^[A-Za-z0-9.+#-]+$/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}
