import { getProviderToken } from "@/server/auth/provider-token";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { getPairStatusForUser, markPairCompleted } from "@/server/db/pair-repo";
import {
  GitHubMutationError,
  createBranch,
  getBranchSha,
  getPublicUser,
  mergePullRequest,
  openPullRequest,
  putFile
} from "@/server/github/mutations";
import { ensureSandboxRepo } from "@/server/github/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs Pair Extraordinaire against the matched partner from the pair queue.
 *
 * Streams SSE the same way /api/achievements/run does, so the /coop UI can
 * use the same console pattern.
 */
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

  const status = await getPairStatusForUser(userRow.id);
  if (status.state !== "matched") {
    return Response.json({ error: "not matched", state: status.state }, { status: 409 });
  }

  const partnerLogin = status.partner.githubLogin;
  const partnerUserId = status.partner.userId;

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
            : `using existing ${sandbox.owner}/${sandbox.repo}`
        });

        send("step", { phase: "lookup", message: `resolve @${partnerLogin}` });
        const partner = await getPublicUser(provider.token, partnerLogin);
        const partnerEmail = `${partner.id}+${partner.login}@users.noreply.github.com`;
        const partnerName = partner.name && partner.name.trim().length > 0 ? partner.name : partner.login;
        send("step", { phase: "lookup-ok", message: `co-author resolved as ${partnerName}` });

        const baseSha = await getBranchSha(provider.token, sandbox.owner, sandbox.repo, sandbox.defaultBranch);
        const ts = Date.now();
        const suffix = Math.random().toString(36).slice(2, 8);
        const branch = `bot/coop-${ts}-${suffix}`;
        const filePath = `entries/coop-${ts}-${suffix}.md`;

        send("step", { phase: "branch", message: `branch ${branch}` });
        await createBranch(provider.token, sandbox.owner, sandbox.repo, branch, baseSha);

        const commitMessage = [
          `feat: pair commit with @${partner.login}`,
          "",
          `Co-authored-by: ${partnerName} <${partnerEmail}>`
        ].join("\n");

        const authorEmail = provider.email ?? `${provider.login}@users.noreply.github.com`;
        send("step", { phase: "commit", message: `commit ${filePath} with co-author trailer` });
        await putFile({
          token: provider.token,
          owner: sandbox.owner,
          repo: sandbox.repo,
          branch,
          path: filePath,
          content: buildCoopEntry(provider.login, partner.login),
          message: commitMessage,
          authorName: provider.login,
          authorEmail
        });

        send("step", { phase: "pr", message: "open PR" });
        const pr = await openPullRequest({
          token: provider.token,
          owner: sandbox.owner,
          repo: sandbox.repo,
          head: branch,
          base: sandbox.defaultBranch,
          title: `Pair Board: @${provider.login} × @${partner.login}`,
          body: `Mutual Pair Extraordinaire run from the github-active /coop queue. Both authors should earn the badge.`
        });
        send("step", { phase: "pr-opened", message: `pr #${pr.number} opened`, number: pr.number, url: pr.html_url });

        send("step", { phase: "merge", message: `merge pr #${pr.number}` });
        await mergePullRequest({
          token: provider.token,
          owner: sandbox.owner,
          repo: sandbox.repo,
          number: pr.number,
          method: "merge"
        });
        send("step", { phase: "merged", message: `pr #${pr.number} merged`, number: pr.number, url: pr.html_url });

        await markPairCompleted({ userId: userRow.id, partnerUserId });
        send("done", {
          message: "complete — both accounts should be credited within 15 minutes",
          profileUrl: `https://github.com/${provider.login}?tab=achievements`
        });
      } catch (error) {
        if (error instanceof GitHubMutationError) {
          send("error", { status: error.status, retryAfterSeconds: error.retryAfterSeconds, message: error.message });
        } else {
          send("error", { status: 500, message: error instanceof Error ? error.message : "unknown error" });
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

function buildCoopEntry(actor: string, partner: string): string {
  return [
    `# Pair Board entry — @${actor} × @${partner}`,
    "",
    `- timestamp: ${new Date().toISOString()}`,
    "- via: github-active /coop queue",
    "",
    "Mutual Pair Extraordinaire commit. Both accounts should be credited.",
    ""
  ].join("\n");
}
