import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { getDatabase } from "@/server/db/client";
import { contributionDrafts } from "@/server/db/schema";
import {
  createBranch,
  getBranchSha,
  putFile
} from "@/server/github/mutations";
import {
  forkRepo,
  openUpstreamPullRequest,
  syncFork
} from "@/server/github/forks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SubmitSchema = z.object({
  draftId: z.string().uuid(),
  edits: z
    .array(
      z.object({
        path: z.string().min(1),
        newContent: z.string()
      })
    )
    .optional()
});

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !origin.endsWith(host)) {
    return Response.json({ error: "cross-origin" }, { status: 403 });
  }

  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  const userRow = await ensureUserFromProvider(provider);
  if (!userRow) {
    return Response.json({ error: "database not configured", reason: "db_unavailable" }, { status: 503 });
  }

  let body: z.infer<typeof SubmitSchema>;
  try {
    body = SubmitSchema.parse((await request.json()) as unknown);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "bad input" }, { status: 400 });
  }

  const db = getDatabase();
  if (!db) return Response.json({ error: "database unavailable" }, { status: 503 });

  const rows = await db
    .select()
    .from(contributionDrafts)
    .where(and(eq(contributionDrafts.id, body.draftId), eq(contributionDrafts.userId, userRow.id)))
    .limit(1);
  const draftRow = rows[0];
  if (!draftRow) return Response.json({ error: "draft not found" }, { status: 404 });
  if (draftRow.submittedPrUrl) {
    return Response.json({ ok: true, prUrl: draftRow.submittedPrUrl, reused: true });
  }

  const draft = draftRow.draft;
  const editsByPath = new Map((body.edits ?? []).map((e) => [e.path, e.newContent]));
  const finalFiles = draft.filesToChange.map((file) => ({
    path: file.path,
    newContent: editsByPath.get(file.path) ?? file.newContent
  }));
  if (finalFiles.length === 0) {
    return Response.json({ error: "draft has no file changes" }, { status: 400 });
  }

  const upstreamOwner = draftRow.upstreamOwner;
  const upstreamRepo = draftRow.upstreamRepo;

  // 1. Fork the upstream repo (or reuse existing fork).
  const fork = await forkRepo(provider.token, upstreamOwner, upstreamRepo);

  // 2. Make sure the fork's default branch is up to date with upstream.
  await syncFork(provider.token, fork.owner.login, fork.name, fork.default_branch);

  // 3. Create a branch on the fork.
  const baseSha = await getBranchSha(
    provider.token,
    fork.owner.login,
    fork.name,
    fork.default_branch
  );
  const branchName = `github-active/issue-${draftRow.issueNumber}-${randomSuffix()}`;
  await createBranch(provider.token, fork.owner.login, fork.name, branchName, baseSha);

  // 4. Commit each file change as a separate commit (clearer history).
  for (const file of finalFiles) {
    await putFile({
      token: provider.token,
      owner: fork.owner.login,
      repo: fork.name,
      branch: branchName,
      path: file.path,
      content: file.newContent,
      message: `${draft.commitMessage} (${file.path})`
    });
  }

  // 5. Open the PR upstream.
  const pr = await openUpstreamPullRequest({
    token: provider.token,
    upstreamOwner,
    upstreamRepo,
    fromOwner: fork.owner.login,
    fromBranch: branchName,
    toBranch: draft.baseBranch,
    title: draft.prTitle,
    body: `${draft.prBody}\n\n---\n\nDrafted with the github-active AI Contribute wizard. The author reviewed and edited before submitting.\nIssue: ${upstreamOwner}/${upstreamRepo}#${draftRow.issueNumber}`
  });

  // 6. Persist the upstream PR URL on the draft.
  await db
    .update(contributionDrafts)
    .set({ submittedPrUrl: pr.html_url })
    .where(eq(contributionDrafts.id, draftRow.id));

  return Response.json({ ok: true, prUrl: pr.html_url, prNumber: pr.number, fork: fork.full_name });
}
