import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import {
  GitHubMutationError,
  closeIssue,
  createBranch,
  getBranchSha,
  getPublicUser,
  mergePullRequest,
  openIssue,
  openPullRequest,
  putFile,
  sleep
} from "@/server/github/mutations";
import { ensureSandboxRepo } from "@/server/github/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RunInputSchema = z.object({
  achievement: z.enum(["pull-shark", "yolo", "quickdraw", "pair-extraordinaire"]),
  count: z.number().int().min(1).max(16).optional(),
  pairWith: z.string().trim().min(1).max(80).optional()
});

const PR_PACING_MS = 800;

export async function POST(request: Request): Promise<Response> {
  // Light CSRF guard: only accept same-origin requests.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !origin.endsWith(host)) {
    return Response.json({ error: "cross-origin request rejected" }, { status: 403 });
  }

  let parsed;
  try {
    const body = (await request.json()) as unknown;
    parsed = RunInputSchema.parse(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "invalid body" },
      { status: 400 }
    );
  }

  const provider = await getProviderToken();
  if (!provider) {
    return Response.json(
      { error: "Sign in with GitHub before running the lab.", reason: "reauth_required" },
      { status: 401 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send("step", { phase: "auth", message: `signed in as ${provider.login}` });

        const sandbox = await ensureSandboxRepo(provider.token, provider.login);
        send("step", {
          phase: "sandbox",
          message: sandbox.created
            ? `created ${sandbox.owner}/${sandbox.repo}`
            : `using existing ${sandbox.owner}/${sandbox.repo}`,
          owner: sandbox.owner,
          repo: sandbox.repo,
          defaultBranch: sandbox.defaultBranch
        });

        switch (parsed.achievement) {
          case "pull-shark":
          case "yolo":
            await runPullRequestFlow({
              token: provider.token,
              sandbox,
              count: parsed.count ?? 2,
              kind: parsed.achievement,
              send
            });
            break;
          case "quickdraw":
            await runQuickdraw({ token: provider.token, sandbox, send });
            break;
          case "pair-extraordinaire":
            if (!parsed.pairWith) {
              throw new Error("Provide a partner GitHub username to credit as co-author.");
            }
            await runPairExtraordinaire({
              token: provider.token,
              sandbox,
              pairWith: parsed.pairWith,
              actorLogin: provider.login,
              actorEmail: provider.email,
              send
            });
            break;
        }

        send("done", {
          message: "complete — GitHub typically awards the achievement within 15 minutes",
          profileUrl: `https://github.com/${provider.login}?tab=achievements`
        });
      } catch (error) {
        if (error instanceof GitHubMutationError) {
          send("error", {
            status: error.status,
            retryAfterSeconds: error.retryAfterSeconds,
            message: error.message
          });
        } else {
          send("error", {
            status: 500,
            retryAfterSeconds: null,
            message: error instanceof Error ? error.message : "unknown error"
          });
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

type Sandbox = { owner: string; repo: string; defaultBranch: string };
type Send = (event: string, data: Record<string, unknown>) => void;

async function runPullRequestFlow(input: {
  token: string;
  sandbox: Sandbox;
  count: number;
  kind: "pull-shark" | "yolo";
  send: Send;
}): Promise<void> {
  const { token, sandbox, count, kind, send } = input;
  const baseSha = await getBranchSha(token, sandbox.owner, sandbox.repo, sandbox.defaultBranch);
  const ts = Date.now();
  const prefix = kind === "yolo" ? "yolo" : "ps";

  for (let i = 1; i <= count; i += 1) {
    const branch = `bot/${prefix}-${ts}-${i}`;
    const filePath = `entries/${prefix}-${ts}-${i}.md`;
    const content = buildEntry({
      kind,
      index: i,
      total: count,
      ts
    });

    send("step", { phase: "branch", message: `branch ${branch} from ${sandbox.defaultBranch}` });
    await createBranch(token, sandbox.owner, sandbox.repo, branch, baseSha);

    send("step", { phase: "commit", message: `commit ${filePath}` });
    await putFile({
      token,
      owner: sandbox.owner,
      repo: sandbox.repo,
      branch,
      path: filePath,
      content,
      message: `${kind === "yolo" ? "yolo" : "feat"}: ${prefix} entry ${i}/${count}`
    });

    send("step", { phase: "pr", message: `open PR for ${branch}` });
    const pr = await openPullRequest({
      token,
      owner: sandbox.owner,
      repo: sandbox.repo,
      head: branch,
      base: sandbox.defaultBranch,
      title: `${kind === "yolo" ? "YOLO" : "Pull Shark"} entry ${i}/${count}`,
      body: `Automated PR from github-active Achievement Lab.\n\nPart of a ${count}-PR run.`
    });
    send("step", {
      phase: "pr-opened",
      message: `pr #${pr.number} opened`,
      number: pr.number,
      url: pr.html_url
    });

    send("step", { phase: "merge", message: `merge pr #${pr.number}` });
    await mergePullRequest({
      token,
      owner: sandbox.owner,
      repo: sandbox.repo,
      number: pr.number,
      method: "squash"
    });
    send("step", {
      phase: "merged",
      message: `pr #${pr.number} merged`,
      number: pr.number,
      url: pr.html_url
    });

    if (i < count) await sleep(PR_PACING_MS);
  }

  send("step", {
    phase: "summary",
    message: `${count} ${count === 1 ? "PR" : "PRs"} merged into ${sandbox.defaultBranch}`
  });
}

async function runQuickdraw(input: { token: string; sandbox: Sandbox; send: Send }): Promise<void> {
  const { token, sandbox, send } = input;
  send("step", { phase: "issue", message: "open issue" });
  const issue = await openIssue({
    token,
    owner: sandbox.owner,
    repo: sandbox.repo,
    title: `Quickdraw run ${new Date().toISOString()}`,
    body: "Automated issue from github-active Achievement Lab. Closing in a few seconds to qualify for Quickdraw."
  });
  send("step", {
    phase: "issue-opened",
    message: `issue #${issue.number} opened`,
    number: issue.number,
    url: issue.html_url
  });

  await sleep(2000);

  send("step", { phase: "issue-close", message: `close issue #${issue.number}` });
  const closed = await closeIssue({ token, owner: sandbox.owner, repo: sandbox.repo, number: issue.number });
  send("step", {
    phase: "issue-closed",
    message: `issue #${closed.number} closed (${humanSeconds(issue.created_at)})`,
    number: closed.number,
    url: closed.html_url
  });
}

async function runPairExtraordinaire(input: {
  token: string;
  sandbox: Sandbox;
  pairWith: string;
  actorLogin: string;
  actorEmail: string | null;
  send: Send;
}): Promise<void> {
  const { token, sandbox, pairWith, actorLogin, actorEmail, send } = input;

  send("step", { phase: "lookup", message: `resolve @${pairWith}` });
  const partner = await getPublicUser(token, pairWith);
  const partnerEmail = `${partner.id}+${partner.login}@users.noreply.github.com`;
  const partnerName = partner.name && partner.name.trim().length > 0 ? partner.name : partner.login;
  send("step", {
    phase: "lookup-ok",
    message: `co-author resolved: ${partnerName} <${partnerEmail}>`
  });

  const baseSha = await getBranchSha(token, sandbox.owner, sandbox.repo, sandbox.defaultBranch);
  const ts = Date.now();
  const branch = `bot/pair-${ts}`;
  const filePath = `entries/pair-${ts}.md`;

  send("step", { phase: "branch", message: `branch ${branch}` });
  await createBranch(token, sandbox.owner, sandbox.repo, branch, baseSha);

  const message = [
    `feat: pair entry with @${partner.login}`,
    "",
    `Co-authored-by: ${partnerName} <${partnerEmail}>`
  ].join("\n");

  const authorEmail = actorEmail ?? `${actorLogin}@users.noreply.github.com`;
  send("step", { phase: "commit", message: `commit ${filePath} with co-author trailer` });
  await putFile({
    token,
    owner: sandbox.owner,
    repo: sandbox.repo,
    branch,
    path: filePath,
    content: buildPairEntry(actorLogin, partner.login),
    message,
    authorName: actorLogin,
    authorEmail
  });

  send("step", { phase: "pr", message: "open PR" });
  const pr = await openPullRequest({
    token,
    owner: sandbox.owner,
    repo: sandbox.repo,
    head: branch,
    base: sandbox.defaultBranch,
    title: `Pair Extraordinaire with @${partner.login}`,
    body: `Co-authored commit credited to @${partner.login}.`
  });
  send("step", { phase: "pr-opened", message: `pr #${pr.number} opened`, number: pr.number, url: pr.html_url });

  send("step", { phase: "merge", message: `merge pr #${pr.number}` });
  await mergePullRequest({
    token,
    owner: sandbox.owner,
    repo: sandbox.repo,
    number: pr.number,
    // Use a regular merge so the co-author trailer survives in the merge commit.
    method: "merge"
  });
  send("step", { phase: "merged", message: `pr #${pr.number} merged`, number: pr.number, url: pr.html_url });
}

function buildEntry(input: { kind: "pull-shark" | "yolo"; index: number; total: number; ts: number }): string {
  const date = new Date(input.ts).toISOString();
  return [
    `# ${input.kind === "yolo" ? "YOLO" : "Pull Shark"} entry ${input.index}/${input.total}`,
    "",
    `- timestamp: ${date}`,
    `- run kind: ${input.kind}`,
    "",
    "Generated by the github-active Achievement Lab. Safe to delete.",
    ""
  ].join("\n");
}

function buildPairEntry(actor: string, partner: string): string {
  return [
    `# Pair entry — @${actor} × @${partner}`,
    "",
    `- timestamp: ${new Date().toISOString()}`,
    "",
    "Generated by the github-active Achievement Lab. The commit message includes a",
    "Co-authored-by trailer so GitHub credits both accounts.",
    ""
  ].join("\n");
}

function humanSeconds(createdAt: string): string {
  const delta = Date.now() - new Date(createdAt).getTime();
  if (delta < 1000) return `${delta}ms`;
  return `${Math.round(delta / 1000)}s`;
}
