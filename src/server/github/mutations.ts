import { z } from "zod";
import { githubHeaders } from "@/server/github/client";

const API = "https://api.github.com";

export class GitHubMutationError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfter: string | null) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) || null : null;
  }
}

export class BranchCollisionError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const MAX_RETRIES = 3;
const BACKOFF_MS = [500, 1500, 3500];

async function request<T>(
  url: string,
  init: RequestInit & { token: string },
  schema: z.ZodType<T>
): Promise<T> {
  const { token, ...rest } = init;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      ...rest,
      headers: githubHeaders(token)
    });

    if (response.ok) {
      const raw: unknown = await response.json();
      return schema.parse(raw);
    }

    const body = await response.text();
    const retryAfterHeader = response.headers.get("retry-after");
    const status = response.status;

    // 401: never retry; surface immediately for reauth.
    if (status === 401) {
      throw new GitHubMutationError(
        `GitHub ${rest.method ?? "GET"} ${url} failed (401): ${body}`,
        401,
        retryAfterHeader
      );
    }

    // 422 with "Reference already exists" is a branch / ref collision —
    // surface a typed error so the caller can regenerate the name and retry.
    if (status === 422 && /already exists/i.test(body)) {
      throw new BranchCollisionError(
        `GitHub ref already exists at ${url}: ${body}`
      );
    }

    const isLastAttempt = attempt === MAX_RETRIES;
    const isRetryable =
      status === 403 || status === 429 || (status >= 500 && status < 600);

    if (!isRetryable || isLastAttempt) {
      throw new GitHubMutationError(
        `GitHub ${rest.method ?? "GET"} ${url} failed (${status}): ${body}`,
        status,
        retryAfterHeader
      );
    }

    const headerWait = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null;
    const waitMs = headerWait && headerWait > 0
      ? Math.min(headerWait * 1000, 30_000)
      : BACKOFF_MS[attempt] ?? 3500;

    await sleep(waitMs);
  }

  // Unreachable — the loop either returns or throws.
  throw new GitHubMutationError(`GitHub ${rest.method ?? "GET"} ${url} exhausted retries`, 500, null);
}

const PublicUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable().optional()
});
export type PublicGitHubUser = z.infer<typeof PublicUserSchema>;

export async function getPublicUser(token: string, username: string): Promise<PublicGitHubUser> {
  return request(`${API}/users/${encodeURIComponent(username)}`, { method: "GET", token }, PublicUserSchema);
}

const RepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  default_branch: z.string(),
  owner: z.object({ login: z.string() })
});
export type Repo = z.infer<typeof RepoSchema>;

export async function getRepo(token: string, owner: string, repo: string): Promise<Repo | null> {
  try {
    return await request(`${API}/repos/${owner}/${repo}`, { method: "GET", token }, RepoSchema);
  } catch (error) {
    if (error instanceof GitHubMutationError && error.status === 404) return null;
    throw error;
  }
}

export async function createRepo(
  token: string,
  body: { name: string; description?: string; private?: boolean; autoInit?: boolean }
): Promise<Repo> {
  return request(
    `${API}/user/repos`,
    {
      method: "POST",
      token,
      body: JSON.stringify({
        name: body.name,
        description: body.description,
        private: body.private ?? false,
        auto_init: body.autoInit ?? true,
        has_issues: true,
        has_projects: false,
        has_wiki: false
      })
    },
    RepoSchema
  );
}

const RefSchema = z.object({
  ref: z.string(),
  object: z.object({ sha: z.string(), type: z.string() })
});

export async function getBranchSha(token: string, owner: string, repo: string, branch: string): Promise<string> {
  const result = await request(
    `${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    { method: "GET", token },
    RefSchema
  );
  return result.object.sha;
}

export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  fromSha: string
): Promise<void> {
  await request(
    `${API}/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha })
    },
    RefSchema
  );
}

const PutFileSchema = z.object({
  commit: z.object({ sha: z.string(), html_url: z.string() })
});

export async function putFile(input: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  content: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
}): Promise<{ sha: string; htmlUrl: string }> {
  const body: Record<string, unknown> = {
    message: input.message,
    content: Buffer.from(input.content, "utf8").toString("base64"),
    branch: input.branch
  };

  if (input.authorName && input.authorEmail) {
    body.author = { name: input.authorName, email: input.authorEmail };
    body.committer = { name: input.authorName, email: input.authorEmail };
  }

  const result = await request(
    `${API}/repos/${input.owner}/${input.repo}/contents/${input.path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "PUT",
      token: input.token,
      body: JSON.stringify(body)
    },
    PutFileSchema
  );

  return { sha: result.commit.sha, htmlUrl: result.commit.html_url };
}

const PullRequestSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  state: z.string()
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

export async function openPullRequest(input: {
  token: string;
  owner: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body?: string;
}): Promise<PullRequest> {
  return request(
    `${API}/repos/${input.owner}/${input.repo}/pulls`,
    {
      method: "POST",
      token: input.token,
      body: JSON.stringify({
        title: input.title,
        head: input.head,
        base: input.base,
        body: input.body ?? "",
        maintainer_can_modify: false,
        draft: false
      })
    },
    PullRequestSchema
  );
}

const MergeSchema = z.object({ sha: z.string(), merged: z.boolean() });

export async function mergePullRequest(input: {
  token: string;
  owner: string;
  repo: string;
  number: number;
  method?: "merge" | "squash" | "rebase";
  title?: string;
}): Promise<{ sha: string }> {
  const result = await request(
    `${API}/repos/${input.owner}/${input.repo}/pulls/${input.number}/merge`,
    {
      method: "PUT",
      token: input.token,
      body: JSON.stringify({
        merge_method: input.method ?? "squash",
        commit_title: input.title
      })
    },
    MergeSchema
  );
  return { sha: result.sha };
}

const IssueSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  state: z.string(),
  created_at: z.string()
});
export type Issue = z.infer<typeof IssueSchema>;

export async function openIssue(input: {
  token: string;
  owner: string;
  repo: string;
  title: string;
  body?: string;
}): Promise<Issue> {
  return request(
    `${API}/repos/${input.owner}/${input.repo}/issues`,
    {
      method: "POST",
      token: input.token,
      body: JSON.stringify({ title: input.title, body: input.body ?? "" })
    },
    IssueSchema
  );
}

export async function closeIssue(input: {
  token: string;
  owner: string;
  repo: string;
  number: number;
}): Promise<Issue> {
  return request(
    `${API}/repos/${input.owner}/${input.repo}/issues/${input.number}`,
    {
      method: "PATCH",
      token: input.token,
      body: JSON.stringify({ state: "closed" })
    },
    IssueSchema
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
