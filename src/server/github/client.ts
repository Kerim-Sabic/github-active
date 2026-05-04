import { createSign } from "node:crypto";
import { z } from "zod";
import { getGithubPrivateKey, requireEnv, serverEnv } from "@/server/env";
import { type GeneratedCommit } from "@/server/automation/types";

const GitHubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  avatar_url: z.string().nullable(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional()
});

const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  default_branch: z.string(),
  owner: z.object({
    login: z.string()
  })
});

const InstallationRepositoriesSchema = z.object({
  repositories: z.array(GitHubRepositorySchema)
});

const OAuthTokenSchema = z.object({
  access_token: z.string()
});

const ContentFileSchema = z.object({
  sha: z.string().optional()
});

const CreateFileResponseSchema = z.object({
  commit: z.object({
    sha: z.string(),
    html_url: z.string()
  })
});

export type GitHubUser = z.infer<typeof GitHubUserSchema>;
export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;

export async function exchangeCodeForUserToken(code: string, redirectUri?: string): Promise<string> {
  const clientId = requireEnv(serverEnv.GITHUB_APP_CLIENT_ID, "GITHUB_APP_CLIENT_ID");
  const clientSecret = requireEnv(serverEnv.GITHUB_APP_CLIENT_SECRET, "GITHUB_APP_CLIENT_SECRET");
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      ...(redirectUri ? { redirect_uri: redirectUri } : {})
    })
  });

  const raw: unknown = await response.json();
  return OAuthTokenSchema.parse(raw).access_token;
}

export async function getGitHubUser(userToken: string): Promise<GitHubUser> {
  return requestGitHub("https://api.github.com/user", userToken, GitHubUserSchema);
}

export async function getInstallationToken(installationId: number): Promise<string> {
  const appId = requireEnv(serverEnv.GITHUB_APP_ID, "GITHUB_APP_ID");
  const jwt = createGitHubAppJwt(appId);
  const schema = z.object({ token: z.string() });

  const result = await requestGitHub(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    jwt,
    schema,
    { method: "POST", tokenType: "Bearer" }
  );

  return result.token;
}

export async function listInstallationRepositories(installationToken: string): Promise<GitHubRepository[]> {
  const result = await requestGitHub(
    "https://api.github.com/installation/repositories?per_page=100",
    installationToken,
    InstallationRepositoriesSchema
  );
  return result.repositories;
}

export async function listUserInstallationRepositories(userToken: string, installationId: number): Promise<GitHubRepository[]> {
  const result = await requestGitHub(
    `https://api.github.com/user/installations/${installationId}/repositories?per_page=100`,
    userToken,
    InstallationRepositoriesSchema
  );
  return result.repositories;
}

export async function createOrUpdateRepositoryFile(input: {
  installationToken: string;
  owner: string;
  repo: string;
  branch: string;
  commit: GeneratedCommit;
  authorName: string;
  authorEmail: string;
}): Promise<{ sha: string; htmlUrl: string }> {
  const existingSha = await getExistingFileSha(input);
  const response = await fetch(
    `https://api.github.com/repos/${input.owner}/${input.repo}/contents/${encodeURIComponentPath(input.commit.path)}`,
    {
      method: "PUT",
      headers: githubHeaders(input.installationToken),
      body: JSON.stringify({
        message: input.commit.message,
        content: Buffer.from(input.commit.content, "utf8").toString("base64"),
        branch: input.branch,
        sha: existingSha,
        author: {
          name: input.authorName,
          email: input.authorEmail
        },
        committer: {
          name: input.authorName,
          email: input.authorEmail
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub file write failed with ${response.status}: ${await response.text()}`);
  }

  const raw: unknown = await response.json();
  const parsed = CreateFileResponseSchema.parse(raw);
  return { sha: parsed.commit.sha, htmlUrl: parsed.commit.html_url };
}

async function getExistingFileSha(input: {
  installationToken: string;
  owner: string;
  repo: string;
  branch: string;
  commit: GeneratedCommit;
}): Promise<string | undefined> {
  const response = await fetch(
    `https://api.github.com/repos/${input.owner}/${input.repo}/contents/${encodeURIComponentPath(input.commit.path)}?ref=${encodeURIComponent(input.branch)}`,
    { headers: githubHeaders(input.installationToken) }
  );

  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`GitHub file lookup failed with ${response.status}: ${await response.text()}`);
  }

  const raw: unknown = await response.json();
  return ContentFileSchema.parse(raw).sha;
}

async function requestGitHub<T>(
  url: string,
  token: string,
  schema: z.ZodType<T>,
  options: { method?: "GET" | "POST"; tokenType?: "Bearer" | "token" } = {}
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: githubHeaders(token, options.tokenType)
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed with ${response.status}: ${await response.text()}`);
  }

  const raw: unknown = await response.json();
  return schema.parse(raw);
}

function githubHeaders(token: string, tokenType: "Bearer" | "token" = "Bearer"): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `${tokenType} ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-active-netlify-saas"
  };
}

function createGitHubAppJwt(appId: string): string {
  const privateKey = getGithubPrivateKey();
  if (!privateKey) throw new Error("GITHUB_APP_PRIVATE_KEY is required for installation tokens.");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" }), "utf8").toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }), "utf8").toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

function encodeURIComponentPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
