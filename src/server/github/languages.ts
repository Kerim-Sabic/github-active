import { z } from "zod";
import { githubHeaders } from "@/server/github/client";

const ReposSchema = z.array(
  z.object({
    name: z.string(),
    fork: z.boolean(),
    archived: z.boolean(),
    language: z.string().nullable().optional(),
    pushed_at: z.string().nullable().optional(),
    stargazers_count: z.number().optional()
  })
);

/**
 * Returns the user's top languages weighted by recently-pushed,
 * non-fork, non-archived repos. Used to filter issue/discussion search.
 */
export async function getUserTopLanguages(token: string, login: string, max = 3): Promise<string[]> {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed&direction=desc&type=owner`,
    { headers: githubHeaders(token) }
  );
  if (!response.ok) return [];

  const raw: unknown = await response.json();
  const parsed = ReposSchema.safeParse(raw);
  if (!parsed.success) return [];

  const buckets = new Map<string, number>();
  for (const repo of parsed.data) {
    if (repo.fork || repo.archived) continue;
    const language = repo.language ?? null;
    if (!language) continue;
    const stars = repo.stargazers_count ?? 0;
    const recencyWeight = repo.pushed_at
      ? recencyMultiplier(new Date(repo.pushed_at).getTime())
      : 0.3;
    buckets.set(language, (buckets.get(language) ?? 0) + (1 + Math.log10(stars + 1)) * recencyWeight);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([lang]) => lang);
}

function recencyMultiplier(pushedAtMs: number): number {
  const days = (Date.now() - pushedAtMs) / (1000 * 60 * 60 * 24);
  if (days < 30) return 1.5;
  if (days < 180) return 1.0;
  if (days < 365) return 0.6;
  return 0.3;
}
