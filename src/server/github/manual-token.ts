import { z } from "zod";
import { generateCommit } from "@/server/automation/content-generator";
import { type AutomationConfig } from "@/server/automation/types";
import { createDemoConfig } from "@/server/db/demo-data";
import { createOrUpdateRepositoryFile } from "@/server/github/client";

const OptionalUsernameSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).max(80).optional()
);

const ManualTokenInputSchema = z.object({
  token: z.string().trim().min(20),
  username: OptionalUsernameSchema
});

const ManualCommitInputSchema = z.object({
  token: z.string().trim().min(20),
  username: OptionalUsernameSchema,
  repoFullName: z.string().trim().regex(/^[^/\s]+\/[^/\s]+$/),
  branch: z.string().trim().min(1).default("main"),
  authorName: z.string().trim().min(1).max(120),
  authorEmail: z.string().trim().email()
});

const ManualUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().nullable(),
  html_url: z.string()
});

const ManualRepositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  private: z.boolean(),
  default_branch: z.string(),
  permissions: z
    .object({
      push: z.boolean().optional()
    })
    .optional()
});

const ManualRepositoriesSchema = z.array(ManualRepositorySchema);

export type ManualTokenValidation = {
  id: number;
  login: string;
  profileUrl: string;
  avatarUrl: string | null;
  noReplyEmail: string;
  usernameMatches: boolean | null;
  repositories: ManualRepositoryAccess[];
};

export type ManualRepositoryAccess = {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  canPush: boolean;
};

export type ManualCommitResult = {
  commit: {
    path: string;
    message: string;
    content: string;
  };
  github: {
    sha: string;
    htmlUrl: string;
  };
};

export async function validateManualToken(rawInput: unknown): Promise<ManualTokenValidation> {
  const input = ManualTokenInputSchema.parse(rawInput);
  const user = await manualGitHubRequest("https://api.github.com/user", input.token, ManualUserSchema);
  const repositories = await manualGitHubRequest(
    "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator&sort=updated",
    input.token,
    ManualRepositoriesSchema
  );

  return {
    id: user.id,
    login: user.login,
    profileUrl: user.html_url,
    avatarUrl: user.avatar_url,
    noReplyEmail: `${user.id}+${user.login}@users.noreply.github.com`,
    usernameMatches: input.username ? input.username.toLowerCase() === user.login.toLowerCase() : null,
    repositories: repositories.map(toManualRepositoryAccess)
  };
}

export async function getManualRepositoryAccess(token: string, fullName: string): Promise<ManualRepositoryAccess> {
  const repo = await manualGitHubRequest(
    `https://api.github.com/repos/${encodeURIComponentPath(fullName)}`,
    token,
    ManualRepositorySchema
  );
  return toManualRepositoryAccess(repo);
}

export async function createManualJournalCommit(rawInput: unknown): Promise<ManualCommitResult> {
  const input = ManualCommitInputSchema.parse(rawInput);
  const validation = await validateManualToken({ token: input.token, username: input.username });
  const repository = validation.repositories.find((repo) => repo.fullName === input.repoFullName);

  if (!repository) {
    throw new Error("Selected repository was not returned by GitHub for this token.");
  }

  if (!repository.canPush) {
    throw new Error("Selected repository is read-only for this token.");
  }

  const [owner, repoName] = input.repoFullName.split("/") as [string, string];
  const dueAt = new Date();
  const config = buildManualConfig({
    owner,
    repoName,
    fullName: input.repoFullName,
    branch: input.branch,
    authorName: input.authorName,
    authorEmail: input.authorEmail
  });
  const seed = `manual:${input.repoFullName}:${input.branch}:${dueAt.toISOString()}`;
  const commit = generateCommit(config, dueAt, seed);
  const github = await createOrUpdateRepositoryFile({
    installationToken: input.token,
    owner,
    repo: repoName,
    branch: input.branch,
    commit,
    authorName: input.authorName,
    authorEmail: input.authorEmail
  });

  return {
    commit: {
      path: commit.path,
      message: commit.message,
      content: commit.content
    },
    github: {
      sha: github.sha,
      htmlUrl: github.htmlUrl
    }
  };
}

function buildManualConfig(input: {
  owner: string;
  repoName: string;
  fullName: string;
  branch: string;
  authorName: string;
  authorEmail: string;
}): AutomationConfig {
  return {
    ...createDemoConfig(),
    repo: {
      owner: input.owner,
      name: input.repoName,
      fullName: input.fullName
    },
    branch: input.branch,
    tracks: ["backend", "devops", "security"],
    intensity: "steady",
    catchUpPolicy: "skip",
    authorName: input.authorName,
    authorEmail: input.authorEmail
  };
}

function toManualRepositoryAccess(repo: z.infer<typeof ManualRepositorySchema>): ManualRepositoryAccess {
  return {
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    canPush: Boolean(repo.permissions?.push)
  };
}

async function manualGitHubRequest<T>(url: string, token: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "github-active-manual-validator"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`GitHub token validation failed with ${response.status}.`);
  }

  const raw: unknown = await response.json();
  return schema.parse(raw);
}

function encodeURIComponentPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
