import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { getDatabase } from "@/server/db/client";
import {
  contributionDrafts,
  type ContributionDraftPayload,
  type DraftFileChange
} from "@/server/db/schema";
import {
  OpenAIError,
  OpenAIInvalidKeyError,
  OpenAIQuotaError,
  defaultModel,
  streamReasoning
} from "@/server/openai/client";
import { resolveOpenAIKey } from "@/server/openai/key-resolver";
import { checkQuota, recordUsage } from "@/server/openai/quota";
import { githubHeaders } from "@/server/github/client";
import { getBranchSha } from "@/server/github/mutations";
import { getRepoTree, pickContextFiles, getFileContent } from "@/server/github/file-fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InputSchema = z.object({
  owner: z.string().trim().min(1).max(80),
  repo: z.string().trim().min(1).max(120),
  issueNumber: z.number().int().positive()
});

const IssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  html_url: z.string(),
  labels: z.array(z.object({ name: z.string() })),
  user: z.object({ login: z.string() })
});

const RepoMetaSchema = z.object({
  default_branch: z.string(),
  owner: z.object({ login: z.string() }),
  name: z.string(),
  description: z.string().nullable()
});

const SYSTEM_PROMPT = `You are an expert open-source contributor who responds with surgical, minimal code changes.

You will be given:
1. A GitHub issue from a real public repository
2. A handful of files from that repository as context

Your job is to draft the smallest, highest-quality patch that resolves the issue. Output strict JSON in the exact schema described, with no prose before or after.

REQUIREMENTS:
- Only modify files that are necessary. Prefer 1-3 file changes.
- Each file you change must be returned in full as it should appear after the change. Do NOT return diffs.
- Keep changes idiomatic and conservative; match the existing code style of the file.
- If a test file is appropriate, include one.
- The PR title MUST follow conventional-commits ("type(scope): subject"), no period at end.
- The PR body MUST include a short summary, the change list, and a "Verification" section explaining how a reviewer can check it.
- If the issue cannot reasonably be resolved with the context provided, return filesToChange: [] and explain in summary.

OUTPUT JSON SCHEMA (and nothing else):
{
  "summary": string,
  "filesToChange": [{ "path": string, "newContent": string, "reason": string }],
  "commitMessage": string,
  "prTitle": string,
  "prBody": string
}`;

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
      {
        error: "OpenAI key required",
        reason: "byok_required",
        message: "Paste your OpenAI key in /settings to use AI drafting."
      },
      { status: 402 }
    );
  }

  const userRow = await ensureUserFromProvider(provider);
  const userIdForQuota = userRow?.id ?? null;

  const quota = await checkQuota({
    userId: userIdForQuota,
    resolved,
    feature: "contribute_draft"
  });
  if (!quota.allowed) {
    if (resolved.kind === "maintainer" && !quota.unlimited) {
      return Response.json(
        {
          error: "daily quota exhausted",
          reason: "quota_exceeded",
          used: quota.used,
          limit: quota.limit
        },
        { status: 429 }
      );
    }
    if (resolved.kind === "maintainer" && !userRow) {
      return Response.json(
        {
          error: "database not configured for quota tracking — paste your own key in /settings",
          reason: "db_unavailable_for_quota"
        },
        { status: 503 }
      );
    }
  }

  // Fetch issue + repo metadata.
  const issueResponse = await fetch(
    `https://api.github.com/repos/${body.owner}/${body.repo}/issues/${body.issueNumber}`,
    { headers: githubHeaders(provider.token) }
  );
  if (!issueResponse.ok) {
    return Response.json({ error: `issue fetch failed (${issueResponse.status})` }, { status: 404 });
  }
  const issueRaw: unknown = await issueResponse.json();
  const issue = IssueSchema.parse(issueRaw);

  const repoResponse = await fetch(
    `https://api.github.com/repos/${body.owner}/${body.repo}`,
    { headers: githubHeaders(provider.token) }
  );
  if (!repoResponse.ok) {
    return Response.json({ error: `repo fetch failed (${repoResponse.status})` }, { status: 404 });
  }
  const repo = RepoMetaSchema.parse(await repoResponse.json());

  const baseBranch = repo.default_branch;
  const baseSha = await getBranchSha(provider.token, body.owner, body.repo, baseBranch);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send("step", { phase: "context", message: "fetching repo file tree" });
        const tree = await getRepoTree(provider.token, body.owner, body.repo, baseSha);
        const issueText = `${issue.title}\n\n${issue.body ?? ""}`;
        const picked = pickContextFiles({ tree, issueText, maxFiles: 8, maxBytes: 120_000 });
        send("step", {
          phase: "context-picked",
          message: `picked ${picked.length} context files`,
          files: picked.map((f) => ({ path: f.path, size: f.size }))
        });

        const files: { path: string; content: string }[] = [];
        for (const entry of picked) {
          const file = await getFileContent(provider.token, body.owner, body.repo, baseSha, entry.path);
          if (file) files.push({ path: entry.path, content: file.content });
        }

        const userPrompt = buildPrompt({
          issue,
          repo,
          files
        });

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
            maxOutputTokens: 16000
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

        const parsed = parseDraftJson(assembled);
        if (!parsed) {
          send("error", { reason: "parse_failed", message: "Could not parse the model output as JSON." });
          controller.close();
          return;
        }

        const draftPayload: ContributionDraftPayload = {
          summary: parsed.summary,
          filesToChange: parsed.filesToChange,
          commitMessage: parsed.commitMessage,
          prTitle: parsed.prTitle,
          prBody: parsed.prBody,
          baseBranch,
          baseSha
        };

        let draftId: string | null = null;
        if (userRow) {
          const db = getDatabase();
          if (db) {
            const [row] = await db
              .insert(contributionDrafts)
              .values({
                userId: userRow.id,
                upstreamOwner: body.owner,
                upstreamRepo: body.repo,
                issueNumber: body.issueNumber,
                draft: draftPayload
              })
              .returning({ id: contributionDrafts.id });
            draftId = row?.id ?? null;
          }
        }

        await recordUsage({
          userId: userIdForQuota,
          resolved,
          feature: "contribute_draft",
          model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          reasoningTokens: usage.reasoningTokens
        });

        send("done", {
          message: "draft ready",
          draft: draftPayload,
          draftId,
          usage
        });
      } catch (error) {
        send("error", {
          reason: "unknown",
          message: error instanceof Error ? error.message : "unknown error"
        });
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

function buildPrompt(input: {
  issue: z.infer<typeof IssueSchema>;
  repo: z.infer<typeof RepoMetaSchema>;
  files: { path: string; content: string }[];
}): string {
  const fileSections = input.files
    .map((f) => `\n=== FILE: ${f.path} ===\n${f.content}\n=== END FILE ===\n`)
    .join("\n");

  return `Repository: ${input.repo.owner.login}/${input.repo.name}
Default branch: ${input.repo.default_branch}
Description: ${input.repo.description ?? "(none)"}

Issue #${input.issue.number}: ${input.issue.title}
Labels: ${input.issue.labels.map((l) => l.name).join(", ") || "(none)"}
Reporter: @${input.issue.user.login}

ISSUE BODY:
${input.issue.body ?? "(empty)"}

REPOSITORY CONTEXT (selected files):
${fileSections}

Please draft a minimal patch. Respond with ONLY the JSON object specified in the system prompt.`;
}

const DraftJsonSchema = z.object({
  summary: z.string(),
  filesToChange: z.array(
    z.object({
      path: z.string(),
      newContent: z.string(),
      reason: z.string().optional()
    })
  ),
  commitMessage: z.string(),
  prTitle: z.string(),
  prBody: z.string()
});

function parseDraftJson(raw: string): {
  summary: string;
  filesToChange: DraftFileChange[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
} | null {
  // Tolerate code-fence wrapping the JSON.
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try {
    const json = JSON.parse(candidate) as unknown;
    const parsed = DraftJsonSchema.parse(json);
    return {
      summary: parsed.summary,
      filesToChange: parsed.filesToChange.map((f) => ({
        path: f.path,
        newContent: f.newContent,
        reason: f.reason
      })),
      commitMessage: parsed.commitMessage,
      prTitle: parsed.prTitle,
      prBody: parsed.prBody
    };
  } catch {
    return null;
  }
}
