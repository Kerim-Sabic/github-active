"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Code2,
  ExternalLink,
  Github,
  GitPullRequest,
  Loader2,
  RefreshCcw,
  Send,
  Sparkles,
  Star,
  X
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

const OPENAI_KEY_STORAGE = "github-active:openai-key";

type ContributeIssue = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  body: string;
  labels: string[];
  comments: number;
  ageDays: number;
  repo_stars: number;
  repo_language: string | null;
  repo_description: string | null;
  repo_avatar: string | null;
};

type IssuesResponse = { languages: string[]; detected: string[]; issues: ContributeIssue[] };

type DraftFile = { path: string; newContent: string; reason?: string };
type DraftPayload = {
  summary: string;
  filesToChange: DraftFile[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
  baseBranch: string;
  baseSha: string;
};

type DraftState =
  | { status: "idle" }
  | { status: "drafting"; logs: string[]; reasoning: string; tokens: string }
  | { status: "ready"; draft: DraftPayload; draftId: string | null; logs: string[] }
  | { status: "error"; message: string; logs: string[] };

export function ContributeClient({
  authedLogin,
  isMaintainer
}: {
  authedLogin: string | null;
  isMaintainer: boolean;
}) {
  const [issues, setIssues] = useState<ContributeIssue[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [selected, setSelected] = useState<ContributeIssue | null>(null);
  const [draft, setDraft] = useState<DraftState>({ status: "idle" });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ url: string } | { error: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadIssues = useCallback(async (language?: string) => {
    if (!authedLogin) return;
    setLoadingIssues(true);
    try {
      const url = language
        ? `/api/contribute/issues?language=${encodeURIComponent(language)}`
        : "/api/contribute/issues";
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        setIssues([]);
        return;
      }
      const raw = (await response.json()) as IssuesResponse;
      setIssues(raw.issues);
      setLanguages(raw.languages);
      if (!activeLanguage && raw.languages[0]) setActiveLanguage(raw.languages[0]);
    } finally {
      setLoadingIssues(false);
    }
  }, [authedLogin, activeLanguage]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const startDraft = useCallback(
    async (issue: ContributeIssue) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSubmitResult(null);
      setEdits({});
      setDraft({ status: "drafting", logs: [], reasoning: "", tokens: "" });

      const apiKey = typeof window !== "undefined" ? window.localStorage.getItem(OPENAI_KEY_STORAGE) : null;

      try {
        const response = await fetch("/api/contribute/draft", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "X-OpenAI-Key": apiKey } : {})
          },
          body: JSON.stringify({
            owner: issue.owner,
            repo: issue.repo,
            issueNumber: issue.number
          })
        });

        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => ({}))) as { error?: string; reason?: string };
          if (body.reason === "byok_required") {
            setDraft({
              status: "error",
              message: "Paste your OpenAI key in /settings to draft PRs.",
              logs: []
            });
            return;
          }
          if (body.reason === "quota_exceeded") {
            setDraft({
              status: "error",
              message: "Daily maintainer quota exhausted. Paste your own OpenAI key in /settings for unlimited drafts.",
              logs: []
            });
            return;
          }
          setDraft({
            status: "error",
            message: body.error ?? `request failed (${response.status})`,
            logs: []
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx = buffer.indexOf("\n\n");
          while (idx !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            consume(block, setDraft);
            idx = buffer.indexOf("\n\n");
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setDraft({
          status: "error",
          message: error instanceof Error ? error.message : "draft failed",
          logs: []
        });
      }
    },
    []
  );

  const submit = useCallback(async () => {
    if (draft.status !== "ready" || !draft.draftId) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const editsArray = Object.entries(edits).map(([path, newContent]) => ({ path, newContent }));
      const response = await fetch("/api/contribute/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.draftId, edits: editsArray })
      });
      const payload = (await response.json()) as { ok?: boolean; prUrl?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.prUrl) {
        setSubmitResult({ error: payload.error ?? `submit failed (${response.status})` });
      } else {
        setSubmitResult({ url: payload.prUrl });
      }
    } catch (error) {
      setSubmitResult({ error: error instanceof Error ? error.message : "submit failed" });
    } finally {
      setSubmitting(false);
    }
  }, [draft, edits]);

  if (!authedLogin) {
    return (
      <div className="grid gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">OSS Contribute Wizard</h1>
        <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-primary">Sign in with GitHub to find good-first-issue PRs you can ship today.</p>
            <p className="mt-1 text-[12px] text-secondary">
              The wizard searches across the public ecosystem, drafts a real patch with AI, and opens the PR upstream — earning real Pull Shark from real merges.
            </p>
          </div>
          <Button asChild size="sm">
            <a href="/api/supabase/github">
              <Github aria-hidden="true" className="h-3.5 w-3.5" />
              Sign in
            </a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <header className="grid gap-3 md:flex md:items-end md:justify-between">
        <div>
          <Badge tone="success" className="mb-3 inline-flex">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success" />
            Contribute Wizard
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">
            Ship a real PR. Earn real Pull Shark.
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-7 text-secondary">
            Curated <span className="font-mono">good first issue</span> &amp; <span className="font-mono">help wanted</span> across the
            languages you actually write. Pick one, the AI drafts a minimal patch, you review and submit upstream.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-[12px] text-tertiary">
          <KeySourcePill isMaintainer={isMaintainer} />
        </div>
      </header>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.06em] text-tertiary">Languages</span>
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setActiveLanguage(lang);
                loadIssues(lang);
              }}
              className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] transition-colors ${
                lang === activeLanguage
                  ? "border-accent bg-accent-muted/40 text-accent"
                  : "border-border bg-surface text-secondary hover:bg-surface-hover"
              }`}
            >
              {lang}
            </button>
          ))}
          <Button onClick={() => loadIssues(activeLanguage ?? undefined)} loading={loadingIssues} size="sm" variant="secondary" className="ml-auto">
            <RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {issues.length === 0 && !loadingIssues ? (
            <Card>
              <p className="text-[12px] text-secondary">No matching issues right now. Try a different language or refresh in a few minutes.</p>
            </Card>
          ) : null}
          {issues.map((issue) => (
            <IssueCard
              key={`${issue.owner}/${issue.repo}#${issue.number}`}
              issue={issue}
              onPick={() => setSelected(issue)}
              active={selected?.url === issue.url}
            />
          ))}
        </div>
      </section>

      {selected ? (
        <IssueDrawer
          issue={selected}
          draft={draft}
          edits={edits}
          submitting={submitting}
          submitResult={submitResult}
          onClose={() => setSelected(null)}
          onDraft={() => startDraft(selected)}
          onEdit={(path, value) => setEdits((current) => ({ ...current, [path]: value }))}
          onSubmit={submit}
        />
      ) : null}
    </div>
  );
}

function consume(block: string, setDraft: (next: DraftState | ((prev: DraftState) => DraftState)) => void): void {
  const lines = block.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return;
  }

  if (event === "step") {
    const message = String(payload.message ?? "");
    setDraft((prev) =>
      prev.status === "drafting"
        ? { ...prev, logs: [...prev.logs, message] }
        : prev
    );
  } else if (event === "delta") {
    const text = String(payload.text ?? "");
    setDraft((prev) =>
      prev.status === "drafting" ? { ...prev, tokens: prev.tokens + text } : prev
    );
  } else if (event === "reasoning") {
    const text = String(payload.text ?? "");
    setDraft((prev) =>
      prev.status === "drafting" ? { ...prev, reasoning: prev.reasoning + text } : prev
    );
  } else if (event === "error") {
    const message = String(payload.message ?? "draft failed");
    setDraft((prev) => ({
      status: "error",
      message,
      logs: prev.status === "drafting" ? prev.logs : []
    }));
  } else if (event === "done") {
    const draftPayload = payload.draft as DraftPayload | undefined;
    const draftId = (payload.draftId as string | undefined) ?? null;
    if (!draftPayload) return;
    setDraft((prev) => ({
      status: "ready",
      draft: draftPayload,
      draftId,
      logs: prev.status === "drafting" ? prev.logs : []
    }));
  }
}

function KeySourcePill({ isMaintainer }: { isMaintainer: boolean }) {
  const localKey = typeof window !== "undefined" ? window.localStorage.getItem(OPENAI_KEY_STORAGE) : null;
  if (localKey) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success-muted bg-success-muted/40 px-2.5 py-1 text-[11px] text-success">
        <Sparkles aria-hidden="true" className="h-3 w-3" />
        Using your OpenAI key
      </span>
    );
  }
  if (isMaintainer) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-muted bg-accent-muted/30 px-2.5 py-1 text-[11px] text-accent">
        <Star aria-hidden="true" className="h-3 w-3" />
        Maintainer key (10 drafts/day)
      </span>
    );
  }
  return (
    <a
      href="/settings"
      className="inline-flex items-center gap-1.5 rounded-full border border-warning-muted bg-warning-muted/30 px-2.5 py-1 text-[11px] text-warning hover:bg-warning-muted/50"
    >
      <AlertTriangle aria-hidden="true" className="h-3 w-3" />
      Add OpenAI key in Settings
    </a>
  );
}

function IssueCard({
  issue,
  onPick,
  active
}: {
  issue: ContributeIssue;
  onPick: () => void;
  active: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer transition-colors ${
        active ? "border-accent bg-surface-raised/95" : "hover:border-border-strong"
      }`}
    >
      <button onClick={onPick} className="grid w-full gap-3 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {issue.repo_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={issue.repo_avatar} alt="" className="h-8 w-8 shrink-0 rounded-md border border-border" />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-[12px] font-mono text-tertiary">{issue.owner}/{issue.repo}</p>
              <p className="line-clamp-2 text-[13px] font-semibold text-primary">{issue.title}</p>
            </div>
          </div>
          <Badge tone="accent">#{issue.number}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-tertiary">
          {issue.repo_language ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
              <Code2 aria-hidden="true" className="h-3 w-3" />
              {issue.repo_language}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
            <Star aria-hidden="true" className="h-3 w-3" />
            {issue.repo_stars.toLocaleString()}
          </span>
          <span className="rounded-full border border-border bg-surface px-2 py-0.5">{issue.ageDays}d old</span>
          <span className="rounded-full border border-border bg-surface px-2 py-0.5">{issue.comments} comments</span>
        </div>
      </button>
    </Card>
  );
}

function IssueDrawer({
  issue,
  draft,
  edits,
  submitting,
  submitResult,
  onClose,
  onDraft,
  onEdit,
  onSubmit
}: {
  issue: ContributeIssue;
  draft: DraftState;
  edits: Record<string, string>;
  submitting: boolean;
  submitResult: { url: string } | { error: string } | null;
  onClose: () => void;
  onDraft: () => void;
  onEdit: (path: string, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid grid-rows-[1fr_auto] bg-bg/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto w-full max-w-5xl overflow-y-auto px-6 pb-6 pt-12">
        <Card className="grid gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-mono text-tertiary">{issue.owner}/{issue.repo}#{issue.number}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-primary">{issue.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-md text-tertiary transition-colors hover:bg-surface-hover hover:text-primary"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-4 font-mono text-[12px] leading-6 text-secondary">
            {issue.body || "(no description)"}
          </pre>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="secondary">
              <a href={issue.url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                Open on GitHub
              </a>
            </Button>
            {draft.status === "idle" || draft.status === "error" ? (
              <Button onClick={onDraft} size="sm">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                Draft a PR with AI
              </Button>
            ) : null}
            {draft.status === "drafting" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-muted bg-accent-muted/40 px-3 py-1 text-[11px] text-accent">
                <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                Drafting…
              </span>
            ) : null}
          </div>

          {draft.status === "drafting" ? <DraftingPanel state={draft} /> : null}
          {draft.status === "error" ? (
            <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{draft.message}</p>
            </div>
          ) : null}
          {draft.status === "ready" ? (
            <ReadyPanel
              draft={draft.draft}
              edits={edits}
              onEdit={onEdit}
              onSubmit={onSubmit}
              submitting={submitting}
              submitResult={submitResult}
              hasDraftId={Boolean(draft.draftId)}
            />
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function DraftingPanel({ state }: { state: Extract<DraftState, { status: "drafting" }> }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="grid gap-1.5 rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-6 text-secondary">
        <p className="text-[10px] uppercase tracking-[0.06em] text-tertiary">Pipeline</p>
        {state.logs.map((log, i) => (
          <div key={`${i}-${log}`} className="flex items-start gap-2">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
            <span>{log}</span>
          </div>
        ))}
        {state.logs.length === 0 ? <span className="text-tertiary">starting…</span> : null}
      </div>
      <div className="grid gap-1.5 rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-6 text-secondary">
        <p className="text-[10px] uppercase tracking-[0.06em] text-tertiary">Streaming output</p>
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[11px] text-primary">
          {state.tokens || (state.reasoning ? `(reasoning…)\n${state.reasoning.slice(-1200)}` : "")}
        </pre>
      </div>
    </div>
  );
}

function ReadyPanel({
  draft,
  edits,
  onEdit,
  onSubmit,
  submitting,
  submitResult,
  hasDraftId
}: {
  draft: DraftPayload;
  edits: Record<string, string>;
  onEdit: (path: string, value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitResult: { url: string } | { error: string } | null;
  hasDraftId: boolean;
}) {
  const [openPath, setOpenPath] = useState<string | null>(draft.filesToChange[0]?.path ?? null);

  const currentEdit = useMemo(() => {
    if (!openPath) return "";
    return edits[openPath] ?? draft.filesToChange.find((f) => f.path === openPath)?.newContent ?? "";
  }, [openPath, draft.filesToChange, edits]);

  return (
    <div className="grid gap-4">
      <div className="rounded-md border border-success-muted bg-success-muted/30 px-3 py-2 text-[12px] text-success">
        <div className="flex items-start gap-2">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{draft.summary}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-[11px] uppercase tracking-[0.06em] text-tertiary">PR title</p>
        <p className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-[12px] text-primary">{draft.prTitle}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <aside className="grid gap-1 self-start rounded-md border border-border bg-surface p-2">
          <p className="px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-tertiary">Files to change</p>
          {draft.filesToChange.length === 0 ? (
            <p className="px-2 py-1 text-[12px] text-secondary">No file changes proposed.</p>
          ) : null}
          {draft.filesToChange.map((file) => (
            <button
              key={file.path}
              onClick={() => setOpenPath(file.path)}
              className={`grid gap-0.5 rounded px-2 py-1.5 text-left text-[12px] transition-colors ${
                openPath === file.path ? "bg-surface-hover text-primary" : "text-secondary hover:bg-surface-hover"
              }`}
            >
              <span className="truncate font-mono">{file.path}</span>
              {file.reason ? (
                <span className="line-clamp-2 text-[10px] text-tertiary">{file.reason}</span>
              ) : null}
            </button>
          ))}
        </aside>
        <div className="grid gap-2">
          {openPath ? (
            <>
              <p className="font-mono text-[11px] text-tertiary">{openPath}</p>
              <textarea
                value={currentEdit}
                onChange={(event) => onEdit(openPath, event.target.value)}
                spellCheck={false}
                className="min-h-[420px] w-full rounded-md border border-border bg-surface p-3 font-mono text-[11.5px] leading-6 text-primary outline-none transition-colors focus:border-accent"
              />
            </>
          ) : (
            <p className="text-[12px] text-secondary">Pick a file on the left to inspect or edit.</p>
          )}
        </div>
      </div>

      <details className="rounded-md border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer text-[11px] text-tertiary">PR body (preview)</summary>
        <pre className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap text-[11px] leading-6 text-secondary">
          {draft.prBody}
        </pre>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onSubmit}
          loading={submitting}
          disabled={!hasDraftId || draft.filesToChange.length === 0}
        >
          <Send aria-hidden="true" className="h-3.5 w-3.5" />
          {hasDraftId ? "Fork & open PR upstream" : "Database not configured — submit unavailable"}
        </Button>
        {!hasDraftId ? (
          <p className="text-[11px] text-warning">
            <AlertTriangle aria-hidden="true" className="mr-1 inline h-3 w-3" />
            Submit needs Postgres wired up to persist the draft. Set <span className="font-mono">SUPABASE_DATABASE_URL</span> on Netlify.
          </p>
        ) : null}
      </div>

      {submitResult && "url" in submitResult ? (
        <a
          href={submitResult.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md border border-success-muted bg-success-muted/40 px-3 py-2 text-[12px] text-success hover:bg-success-muted/60"
        >
          <GitPullRequest aria-hidden="true" className="h-3.5 w-3.5" />
          PR opened upstream — open on GitHub
          <ArrowRight aria-hidden="true" className="ml-auto h-3.5 w-3.5" />
        </a>
      ) : null}
      {submitResult && "error" in submitResult ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{submitResult.error}</div>
      ) : null}
    </div>
  );
}
