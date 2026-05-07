import { z } from "zod";
import { githubHeaders } from "@/server/github/client";

const ForkSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({ login: z.string() }),
  default_branch: z.string()
});

export type Fork = z.infer<typeof ForkSchema>;

/**
 * POSTs to /forks. GitHub responds 202 immediately while the fork is
 * provisioned async; we then poll /repos/{owner}/{repo} until it exists
 * (usually <2s, but up to ~30s for very large repos).
 */
export async function forkRepo(token: string, upstreamOwner: string, upstreamRepo: string): Promise<Fork> {
  const response = await fetch(
    `https://api.github.com/repos/${upstreamOwner}/${upstreamRepo}/forks`,
    {
      method: "POST",
      headers: githubHeaders(token),
      body: JSON.stringify({ default_branch_only: true })
    }
  );
  if (!response.ok && response.status !== 202) {
    throw new Error(`fork failed (${response.status}): ${await response.text()}`);
  }
  const raw: unknown = await response.json();
  const parsed = ForkSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`fork response shape unexpected: ${parsed.error.message}`);
  }

  // Wait until the fork is reachable (upper bound ~20s).
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ok = await fetch(
      `https://api.github.com/repos/${parsed.data.owner.login}/${parsed.data.name}`,
      { headers: githubHeaders(token) }
    );
    if (ok.ok) return parsed.data;
    await sleep(1500 + attempt * 500);
  }

  return parsed.data;
}

const MergeUpstreamSchema = z.object({
  message: z.string().optional(),
  merge_type: z.string().optional(),
  base_branch: z.string().optional()
});

/**
 * Fast-forward the fork's default branch to upstream. Best-effort.
 */
export async function syncFork(
  token: string,
  forkOwner: string,
  forkRepoName: string,
  branch: string
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${forkOwner}/${forkRepoName}/merge-upstream`,
    {
      method: "POST",
      headers: githubHeaders(token),
      body: JSON.stringify({ branch })
    }
  );
  if (!response.ok) return;
  const raw: unknown = await response.json();
  MergeUpstreamSchema.safeParse(raw);
}

const PullRequestSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  state: z.string()
});
export type UpstreamPullRequest = z.infer<typeof PullRequestSchema>;

/**
 * Opens a PR from {fromOwner}:{fromBranch} → {upstreamOwner}/{upstreamRepo}:{toBranch}.
 */
export async function openUpstreamPullRequest(input: {
  token: string;
  upstreamOwner: string;
  upstreamRepo: string;
  fromOwner: string;
  fromBranch: string;
  toBranch: string;
  title: string;
  body: string;
}): Promise<UpstreamPullRequest> {
  const response = await fetch(
    `https://api.github.com/repos/${input.upstreamOwner}/${input.upstreamRepo}/pulls`,
    {
      method: "POST",
      headers: githubHeaders(input.token),
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        head: `${input.fromOwner}:${input.fromBranch}`,
        base: input.toBranch,
        maintainer_can_modify: true,
        draft: false
      })
    }
  );
  if (!response.ok) {
    throw new Error(`upstream PR failed (${response.status}): ${await response.text()}`);
  }
  const raw: unknown = await response.json();
  return PullRequestSchema.parse(raw);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
