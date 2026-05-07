import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import {
  OpenAIError,
  OpenAIInvalidKeyError,
  OpenAIQuotaError,
  defaultModel,
  streamReasoning
} from "@/server/openai/client";
import { resolveOpenAIKey } from "@/server/openai/key-resolver";
import { checkQuota, recordUsage } from "@/server/openai/quota";
import { getDiscussion } from "@/server/github/discussions";
import { getRepoTree, pickContextFiles, getFileContent } from "@/server/github/file-fetcher";
import { getBranchSha } from "@/server/github/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InputSchema = z.object({
  owner: z.string().trim().min(1).max(80),
  repo: z.string().trim().min(1).max(120),
  number: z.number().int().positive()
});

const SYSTEM_PROMPT = `You are an experienced engineer answering a GitHub Discussions question. Your goal is to write an answer that is genuinely helpful to the asker AND useful enough that a maintainer might mark it as accepted.

REQUIREMENTS:
- Be concrete. Reference actual files in the repo by path when relevant; quote short, accurate snippets only.
- Show how to verify your answer (a small code example, a command, a link to a file).
- Be honest about uncertainty. If you don't know, say so and explain what additional info would resolve it.
- Use friendly, professional tone — neither overly hedged nor robotic.
- Markdown formatting is welcome (headings, code fences, bullet lists).
- Length: aim for 150–400 words. Skip preamble like "Great question!".
- Never claim to have run code you have not. Never make up file contents.
- Sign off with a single line like "— drafted with github-active, please double-check before posting."

Output the answer markdown directly with no JSON wrapper, no system commentary.`;

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

  let body: z.infer<typeof InputSchema>;
  try {
    body = InputSchema.parse((await request.json()) as unknown);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "bad input" }, { status: 400 });
  }

  const resolved = resolveOpenAIKey(request, provider.login);
  if (resolved.kind === "missing") {
    return Response.json(
      { error: "OpenAI key required", reason: "byok_required" },
      { status: 402 }
    );
  }

  const userRow = await ensureUserFromProvider(provider);
  const userIdForQuota = userRow?.id ?? null;
  const quota = await checkQuota({ userId: userIdForQuota, resolved, feature: "hunt_draft" });
  if (!quota.allowed) {
    if (resolved.kind === "maintainer" && !quota.unlimited) {
      return Response.json(
        { error: "daily quota exhausted", reason: "quota_exceeded", used: quota.used, limit: quota.limit },
        { status: 429 }
      );
    }
    if (resolved.kind === "maintainer" && !userRow) {
      return Response.json(
        { error: "database not configured for quota tracking — paste your own key in /settings", reason: "db_unavailable_for_quota" },
        { status: 503 }
      );
    }
  }

  const discussion = await getDiscussion({
    token: provider.token,
    owner: body.owner,
    repo: body.repo,
    number: body.number
  });
  if (!discussion) {
    return Response.json({ error: "discussion not found" }, { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const branch = discussion.defaultBranch ?? "main";
        const baseSha = await getBranchSha(provider.token, body.owner, body.repo, branch).catch(() => null);

        let context: { path: string; content: string }[] = [];
        if (baseSha) {
          send("step", { phase: "context", message: "fetching repo file tree" });
          const tree = await getRepoTree(provider.token, body.owner, body.repo, baseSha);
          const issueText = `${discussion.title}\n\n${discussion.bodyText}`;
          const picked = pickContextFiles({ tree, issueText, maxFiles: 6, maxBytes: 80_000 });
          send("step", {
            phase: "context-picked",
            message: `picked ${picked.length} context files`,
            files: picked.map((f) => f.path)
          });
          for (const entry of picked) {
            const file = await getFileContent(provider.token, body.owner, body.repo, baseSha, entry.path);
            if (file) context.push({ path: entry.path, content: file.content });
          }
        }

        const userPrompt = buildPrompt(body, discussion, context);

        send("step", { phase: "model", message: `drafting with ${defaultModel()} (effort: high)` });

        let assembled = "";
        let usage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
        let model = defaultModel();
        try {
          for await (const event of streamReasoning({
            apiKey: resolved.key,
            system: SYSTEM_PROMPT,
            user: userPrompt,
            effort: "high",
            maxOutputTokens: 6000
          })) {
            if (event.kind === "delta") {
              assembled += event.text;
              send("delta", { text: event.text });
            } else if (event.kind === "reasoning") {
              send("reasoning", { text: event.text });
            } else if (event.kind === "done") {
              usage = event.usage;
              model = event.model;
            } else if (event.kind === "error") {
              throw new Error(event.message);
            }
          }
        } catch (error) {
          if (error instanceof OpenAIInvalidKeyError) {
            send("error", { reason: "invalid_key", message: "OpenAI rejected the API key — re-enter it in /settings." });
            controller.close();
            return;
          }
          if (error instanceof OpenAIQuotaError) {
            send("error", { reason: "openai_quota", message: "OpenAI rate-limited the request. Try again in a minute." });
            controller.close();
            return;
          }
          if (error instanceof OpenAIError) {
            send("error", { reason: "openai_error", message: error.message });
            controller.close();
            return;
          }
          throw error;
        }

        await recordUsage({
          userId: userIdForQuota,
          resolved,
          feature: "hunt_draft",
          model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          reasoningTokens: usage.reasoningTokens
        });

        send("done", { message: "draft ready", answer: assembled, discussionUrl: discussion.url });
      } catch (error) {
        send("error", { reason: "unknown", message: error instanceof Error ? error.message : "unknown error" });
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

function buildPrompt(
  body: z.infer<typeof InputSchema>,
  discussion: NonNullable<Awaited<ReturnType<typeof getDiscussion>>>,
  context: { path: string; content: string }[]
): string {
  const fileSections = context
    .map((f) => `\n=== FILE: ${f.path} ===\n${f.content}\n=== END FILE ===\n`)
    .join("\n");

  const commentBlock = discussion.comments
    .slice(0, 6)
    .map((c, i) => `Comment ${i + 1} from @${c.author ?? "unknown"}:\n${c.body}`)
    .join("\n\n");

  return `Repository: ${body.owner}/${body.repo}
Discussion category: ${discussion.category ?? "(unknown)"}
Discussion URL: ${discussion.url}
Asked by: @${discussion.authorLogin ?? "unknown"}

DISCUSSION TITLE:
${discussion.title}

DISCUSSION BODY:
${discussion.bodyText}

EXISTING COMMENTS:
${commentBlock || "(none)"}

REPOSITORY CONTEXT (selected files):
${fileSections || "(no source context fetched)"}

Draft a helpful markdown answer per the system prompt. Output only the answer markdown.`;
}
