import { eq } from "drizzle-orm";
import { getProviderToken } from "@/server/auth/provider-token";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { getPairStatusForUser, markPairCompleted, markSelfRan } from "@/server/db/pair-repo";
import { getDatabase } from "@/server/db/client";
import { users as usersTable } from "@/server/db/schema";
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
import { generateRealisticEntry } from "@/server/automation/realistic-content";

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
  if (status.state !== "matched" && status.state !== "completed") {
    return Response.json({ error: "not paired", state: status.state }, { status: 409 });
  }

  let partnerLogin: string;
  let partnerUserId: string;
  let partnerAvatarUrl: string | null = null;

  if (status.state === "matched") {
    partnerLogin = status.partner.githubLogin;
    partnerUserId = status.partner.userId;
    partnerAvatarUrl = status.partner.avatarUrl ?? null;
  } else {
    // Completed pair — let the non-clicker run their own side for mutual
    // Pull Shark credit. Look up the partner from the user's own row.
    if (!status.row.matchedWithUserId) {
      return Response.json({ error: "no partner recorded" }, { status: 409 });
    }
    if (status.row.selfRanAt) {
      return Response.json({ error: "already ran your side", state: "self-ran" }, { status: 409 });
    }
    const db = getDatabase();
    if (!db) {
      return Response.json({ error: "database not configured", reason: "db_unavailable" }, { status: 503 });
    }
    const partnerRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, status.row.matchedWithUserId))
      .limit(1);
    const partnerUser = partnerRows[0];
    if (!partnerUser) {
      return Response.json({ error: "partner user not found" }, { status: 404 });
    }
    partnerLogin = partnerUser.login;
    partnerUserId = partnerUser.id;
    partnerAvatarUrl = partnerUser.avatarUrl ?? null;
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
        const entry = generateRealisticEntry({
          ts,
          index: 1,
          total: 1,
          kind: "pair-extraordinaire",
          randomSuffix: suffix,
          partnerLogin: partner.login
        });
        const branch = `pair/${entry.path.split("/").slice(-1)[0]?.replace(/\.[^.]+$/, "") ?? `coop-${ts}`}-${Math.random().toString(36).slice(2, 8)}`;

        send("step", { phase: "branch", message: `branch ${branch}` });
        await createBranch(provider.token, sandbox.owner, sandbox.repo, branch, baseSha);

        const commitMessage = [
          entry.message,
          "",
          `Co-authored-by: ${partnerName} <${partnerEmail}>`
        ].join("\n");

        const authorEmail = provider.email ?? `${provider.login}@users.noreply.github.com`;
        send("step", { phase: "commit", message: `commit ${entry.path} with co-author trailer` });
        await putFile({
          token: provider.token,
          owner: sandbox.owner,
          repo: sandbox.repo,
          branch,
          path: entry.path,
          content: entry.content,
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
          title: `${entry.prTitle} (with @${partner.login})`,
          body: entry.prBody
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

        if (status.state === "matched") {
          // First side runs the canonical pair commit; both sides earn Pair
          // Extraordinaire from the trailer, the clicker also gets a +1 PR
          // for Pull Shark.
          await markPairCompleted({ userId: userRow.id, partnerUserId });
          send("done", {
            message: "complete — partner can now click Run my side for their own Pull Shark +1",
            profileUrl: `https://github.com/${provider.login}?tab=achievements`
          });
        } else {
          // Non-clicker's side: a separate co-authored PR in their sandbox so
          // they get a +1 PR for Pull Shark too.
          await markSelfRan(userRow.id);
          send("done", {
            message: "complete — your side merged, both accounts now have +1 PR each",
            profileUrl: `https://github.com/${provider.login}?tab=achievements`
          });
        }
        // Suppress the unused-variable lint for partnerAvatarUrl when realtime
        // payloads start consuming it — keeps the lookup branch tidy.
        void partnerAvatarUrl;
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

