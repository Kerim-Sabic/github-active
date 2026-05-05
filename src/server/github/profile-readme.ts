import { z } from "zod";
import { type GeneratedCommit } from "@/server/automation/types";
import { createOrUpdateRepositoryFile } from "@/server/github/client";
import { getManualRepositoryAccess, validateManualToken } from "@/server/github/manual-token";

const ProfileReadmeInputSchema = z.object({
  token: z.string().trim().min(20),
  username: z.string().trim().min(1).max(80),
  headline: z.string().trim().min(4).max(140),
  focus: z.string().trim().min(4).max(240),
  projectUrl: z.string().trim().url().optional().or(z.literal("")),
  authorName: z.string().trim().min(1).max(120).optional(),
  authorEmail: z.string().trim().email().optional()
});

export type ProfileReadmeResult = {
  login: string;
  htmlUrl: string;
  sha: string;
};

export async function createProfileReadme(rawInput: unknown): Promise<ProfileReadmeResult> {
  const input = ProfileReadmeInputSchema.parse(rawInput);
  const validation = await validateManualToken({ token: input.token, username: input.username });
  const repoFullName = `${validation.login}/${validation.login}`;
  const profileRepo =
    validation.repositories.find((repo) => repo.fullName.toLowerCase() === repoFullName.toLowerCase()) ??
    (await findProfileRepository(input.token, repoFullName));

  if (!profileRepo) {
    throw new Error(`Create the ${repoFullName} repository first, then retry.`);
  }

  if (!profileRepo.canPush) {
    throw new Error(`The token cannot write to ${repoFullName}.`);
  }

  const commit: GeneratedCommit = {
    path: "README.md",
    message: "Update GitHub profile README",
    content: buildProfileReadme({
      login: validation.login,
      headline: input.headline,
      focus: input.focus,
      projectUrl: input.projectUrl || "https://githubactive.netlify.app"
    }),
    kind: "journal",
    track: "systems",
    idempotencyKey: `profile-readme:${validation.login}:${Date.now()}`
  };

  const github = await createOrUpdateRepositoryFile({
    installationToken: input.token,
    owner: validation.login,
    repo: validation.login,
    branch: profileRepo.defaultBranch,
    commit,
    authorName: input.authorName ?? validation.login,
    authorEmail: input.authorEmail ?? validation.noReplyEmail
  });

  return {
    login: validation.login,
    htmlUrl: github.htmlUrl,
    sha: github.sha
  };
}

async function findProfileRepository(token: string, fullName: string) {
  try {
    return await getManualRepositoryAccess(token, fullName);
  } catch {
    return null;
  }
}

function buildProfileReadme(input: {
  login: string;
  headline: string;
  focus: string;
  projectUrl: string;
}): string {
  return [
    `# ${input.login}`,
    "",
    input.headline,
    "",
    "## Current Focus",
    "",
    input.focus,
    "",
    "## Engineering Signals",
    "",
    "- Building transparent automation tools with explicit audit trails.",
    "- Shipping small, reviewable changes with type checks, tests, and production builds.",
    "- Preferring least-privilege GitHub access and clear operator visibility.",
    "",
    "## Featured Work",
    "",
    `- GitHub Active: ${input.projectUrl}`,
    "",
    "## Operating Principles",
    "",
    "- Make state visible.",
    "- Keep security boundaries explicit.",
    "- Document tradeoffs where future reviewers will look first.",
    ""
  ].join("\n");
}
