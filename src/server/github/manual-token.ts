import { z } from "zod";

const ManualTokenInputSchema = z.object({
  token: z.string().min(20),
  username: z.string().min(1).max(80).optional()
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
  login: string;
  profileUrl: string;
  avatarUrl: string | null;
  usernameMatches: boolean | null;
  repositories: Array<{
    fullName: string;
    private: boolean;
    defaultBranch: string;
    canPush: boolean;
  }>;
};

export async function validateManualToken(rawInput: unknown): Promise<ManualTokenValidation> {
  const input = ManualTokenInputSchema.parse(rawInput);
  const user = await manualGitHubRequest("https://api.github.com/user", input.token, ManualUserSchema);
  const repositories = await manualGitHubRequest(
    "https://api.github.com/user/repos?per_page=12&affiliation=owner,collaborator&sort=updated",
    input.token,
    ManualRepositoriesSchema
  );

  return {
    login: user.login,
    profileUrl: user.html_url,
    avatarUrl: user.avatar_url,
    usernameMatches: input.username ? input.username.toLowerCase() === user.login.toLowerCase() : null,
    repositories: repositories.map((repo) => ({
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      canPush: Boolean(repo.permissions?.push)
    }))
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
