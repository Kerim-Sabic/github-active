import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { githubHeaders } from "@/server/github/client";
import { SANDBOX_REPO_NAME } from "@/server/github/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PullRequestSummarySchema = z.array(
  z.object({
    number: z.number(),
    state: z.string(),
    merged_at: z.string().nullable(),
    requested_reviewers: z.array(z.unknown()).optional(),
    user: z.object({ login: z.string() }).optional()
  })
);

const IssueSummarySchema = z.array(
  z.object({
    number: z.number(),
    state: z.string(),
    pull_request: z.unknown().optional(),
    created_at: z.string(),
    closed_at: z.string().nullable()
  })
);

const CommitSummarySchema = z.array(
  z.object({
    sha: z.string(),
    commit: z.object({
      message: z.string()
    })
  })
);

const PULL_SHARK_TIERS = [1, 2, 16, 128, 1024] as const;

export async function GET(): Promise<Response> {
  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  const owner = provider.login;
  const repo = SANDBOX_REPO_NAME;
  const repoMeta = await fetchOk(
    `https://api.github.com/repos/${owner}/${repo}`,
    provider.token
  );

  if (!repoMeta) {
    return Response.json({
      sandboxExists: false,
      mergedPullRequests: 0,
      mergedPullRequestsWithoutReview: 0,
      closedIssuesUnder5min: 0,
      coAuthoredCommits: 0,
      tiers: nullTiers()
    });
  }

  const [prList, issueList, commitList] = await Promise.all([
    fetchAll(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
      provider.token,
      PullRequestSummarySchema
    ),
    fetchAll(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=closed&per_page=100&sort=updated&direction=desc`,
      provider.token,
      IssueSummarySchema
    ),
    fetchAll(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
      provider.token,
      CommitSummarySchema
    )
  ]);

  const mergedPRs = prList.filter((pr) => pr.merged_at !== null);
  const mergedWithoutReview = mergedPRs.length;

  const closedFastIssues = issueList.filter((issue) => {
    if (issue.pull_request) return false;
    if (!issue.closed_at) return false;
    const elapsed = new Date(issue.closed_at).getTime() - new Date(issue.created_at).getTime();
    return elapsed >= 0 && elapsed <= 5 * 60 * 1000;
  });

  const coAuthored = commitList.filter((commit) =>
    /co-authored-by:/i.test(commit.commit.message)
  );

  const mergedCount = mergedPRs.length;
  const reachedTier = PULL_SHARK_TIERS.reduce<number | null>(
    (acc, tier) => (mergedCount >= tier ? tier : acc),
    null
  );
  const nextTier = PULL_SHARK_TIERS.find((tier) => mergedCount < tier) ?? null;

  return Response.json({
    sandboxExists: true,
    sandboxUrl: `https://github.com/${owner}/${repo}`,
    mergedPullRequests: mergedCount,
    mergedPullRequestsWithoutReview: mergedWithoutReview,
    closedIssuesUnder5min: closedFastIssues.length,
    coAuthoredCommits: coAuthored.length,
    tiers: {
      pullShark: { reached: reachedTier, next: nextTier, all: [...PULL_SHARK_TIERS] },
      yolo: mergedWithoutReview > 0,
      quickdraw: closedFastIssues.length > 0,
      pair: coAuthored.length > 0
    }
  });
}

function nullTiers() {
  return {
    pullShark: { reached: null, next: PULL_SHARK_TIERS[0], all: [...PULL_SHARK_TIERS] },
    yolo: false,
    quickdraw: false,
    pair: false
  };
}

async function fetchOk(url: string, token: string): Promise<unknown | null> {
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (response.status === 404) return null;
  if (!response.ok) return null;
  return response.json();
}

async function fetchAll<T>(url: string, token: string, schema: z.ZodType<T[]>): Promise<T[]> {
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (!response.ok) return [];
  const raw: unknown = await response.json();
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
