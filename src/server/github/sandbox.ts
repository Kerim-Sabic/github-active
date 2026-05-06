import { createRepo, getRepo, putFile } from "@/server/github/mutations";

export const SANDBOX_REPO_NAME = "github-active-sandbox";

const SANDBOX_README = [
  "# github-active-sandbox",
  "",
  "Automation playground for [github-active](https://github.com/Kerim-Sabic/github-active).",
  "",
  "Branches, pull requests, and issues here are created by the Achievement Lab when",
  "you click Run on Pull Shark, YOLO, Quickdraw, or Pair Extraordinaire.",
  "",
  "It is safe to delete this repo at any time. The lab will recreate it on the next run.",
  ""
].join("\n");

export async function ensureSandboxRepo(
  token: string,
  login: string
): Promise<{ owner: string; repo: string; defaultBranch: string; created: boolean }> {
  const existing = await getRepo(token, login, SANDBOX_REPO_NAME);
  if (existing) {
    return {
      owner: existing.owner.login,
      repo: existing.name,
      defaultBranch: existing.default_branch,
      created: false
    };
  }

  const created = await createRepo(token, {
    name: SANDBOX_REPO_NAME,
    description: "Automation playground for GitHub Active. Safe to delete.",
    private: false,
    autoInit: true
  });

  // auto_init takes a moment to materialize. The first PUT to README is the
  // best signal that the default branch ref exists, so we update the seed
  // README rather than checking the ref directly.
  try {
    await putFile({
      token,
      owner: created.owner.login,
      repo: created.name,
      branch: created.default_branch,
      path: "README.md",
      content: SANDBOX_README,
      message: "chore: seed sandbox README"
    });
  } catch {
    // Initial PUT can race against the auto_init commit; ignore — the run
    // route only needs the default branch ref, which auto_init already created.
  }

  return {
    owner: created.owner.login,
    repo: created.name,
    defaultBranch: created.default_branch,
    created: true
  };
}
