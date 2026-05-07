"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Github,
  Loader2,
  MessagesSquare,
  RefreshCcw,
  Sparkles,
  Star,
  X
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

const OPENAI_KEY_STORAGE = "github-active:openai-key";

type Discussion = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  bodyExcerpt: string;
  updatedAt: string;
  category: string | null;
  language: string | null;
  comments: number;
  stars: number;
};

type DraftState =
  | { status: "idle" }
  | { status: "drafting"; logs: string[]; reasoning: string; tokens: string }
  | { status: "ready"; answer: string; discussionUrl: string }
  | { status: "error"; message: string };

export function HuntClient({
  authedLogin,
  isMaintainer
}: {
  authedLogin: string | null;
  isMaintainer: boolean;
}) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Discussion | null>(null);
  const [draft, setDraft] = useState<DraftState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (lang?: string) => {
    if (!authedLogin) return;
    setLoading(true);
    try {
      const url = lang
        ? `/api/hunt/discussions?language=${encodeURIComponent(lang)}`
        : "/api/hunt/discussions";
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        setDiscussions([]);
        return;
      }
      const raw = (await response.json()) as { discussions: Discussion[]; languages: string[] };
      setDiscussions(raw.discussions);
      setLanguages(raw.languages);
      if (!activeLanguage && raw.languages[0]) setActiveLanguage(raw.languages[0]);
    } finally {
      setLoading(false);
    }
  }, [authedLogin, activeLanguage]);

  useEffect(() => {
    load();
  }, [load]);

  const startDraft = useCallback(async (discussion: Discussion) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDraft({ status: "drafting", logs: [], reasoning: "", tokens: "" });

    const apiKey = typeof window !== "undefined" ? window.localStorage.getItem(OPENAI_KEY_STORAGE) : null;

    try {
      const response = await fetch("/api/hunt/draft", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-OpenAI-Key": apiKey } : {})
        },
        body: JSON.stringify({
          owner: discussion.owner,
          repo: discussion.repo,
          number: discussion.number
        })
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; reason?: string };
        if (body.reason === "byok_required") {
          setDraft({ status: "error", message: "Paste your OpenAI key in /settings to draft answers." });
          return;
        }
        if (body.reason === "quota_exceeded") {
          setDraft({ status: "error", message: "Daily maintainer quota exhausted. Add your own OpenAI key in /settings." });
          return;
        }
        setDraft({ status: "error", message: body.error ?? `request failed (${response.status})` });
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
      setDraft({ status: "error", message: error instanceof Error ? error.message : "draft failed" });
    }
  }, []);

  const copyAndOpen = useCallback(async () => {
    if (draft.status !== "ready") return;
    try {
      await navigator.clipboard.writeText(draft.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore — user can still copy manually from the textarea.
    }
    window.open(draft.discussionUrl, "_blank", "noopener,noreferrer");
  }, [draft]);

  if (!authedLogin) {
    return (
      <div className="grid gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">Galaxy Brain Hunter</h1>
        <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[13px] font-semibold text-primary">Sign in with GitHub to find Discussion threads worth answering.</p>
            <p className="mt-1 text-[12px] text-secondary">
              The hunter searches low-answer Discussions in the languages you write, and the AI drafts a substantive starter answer.
              Maintainers mark answers accepted → Galaxy Brain unlocks.
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
            Galaxy Brain Hunter
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">
            Answer real Discussions. Earn Galaxy Brain.
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-7 text-secondary">
            Surfaces fresh, low-answer discussions across the languages you write. The AI drafts a starter answer with file references — you review, edit, post.
          </p>
        </div>
        <KeySourcePill isMaintainer={isMaintainer} />
      </header>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.06em] text-tertiary">Languages</span>
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setActiveLanguage(lang);
                load(lang);
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
          <Button onClick={() => load(activeLanguage ?? undefined)} loading={loading} size="sm" variant="secondary" className="ml-auto">
            <RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {discussions.length === 0 && !loading ? (
            <Card>
              <p className="text-[12px] text-secondary">No matching discussions right now. Try a different language or refresh later.</p>
            </Card>
          ) : null}
          {discussions.map((discussion) => (
            <DiscussionCard
              key={discussion.url}
              discussion={discussion}
              onPick={() => setSelected(discussion)}
              active={selected?.url === discussion.url}
            />
          ))}
        </div>
      </section>

      {selected ? (
        <DiscussionDrawer
          discussion={selected}
          draft={draft}
          copied={copied}
          onClose={() => setSelected(null)}
          onDraft={() => startDraft(selected)}
          onCopyAndOpen={copyAndOpen}
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
      prev.status === "drafting" ? { ...prev, logs: [...prev.logs, message] } : prev
    );
  } else if (event === "delta") {
    const text = String(payload.text ?? "");
    setDraft((prev) => (prev.status === "drafting" ? { ...prev, tokens: prev.tokens + text } : prev));
  } else if (event === "reasoning") {
    const text = String(payload.text ?? "");
    setDraft((prev) =>
      prev.status === "drafting" ? { ...prev, reasoning: prev.reasoning + text } : prev
    );
  } else if (event === "error") {
    setDraft({ status: "error", message: String(payload.message ?? "draft failed") });
  } else if (event === "done") {
    const answer = String(payload.answer ?? "");
    const discussionUrl = String(payload.discussionUrl ?? "");
    setDraft({ status: "ready", answer, discussionUrl });
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

function DiscussionCard({
  discussion,
  onPick,
  active
}: {
  discussion: Discussion;
  onPick: () => void;
  active: boolean;
}) {
  return (
    <Card className={`cursor-pointer transition-colors ${active ? "border-accent bg-surface-raised/95" : "hover:border-border-strong"}`}>
      <button onClick={onPick} className="grid w-full gap-3 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-mono text-tertiary">{discussion.owner}/{discussion.repo}</p>
            <p className="line-clamp-2 text-[13px] font-semibold text-primary">{discussion.title}</p>
          </div>
          <Badge tone="accent">#{discussion.number}</Badge>
        </div>
        <p className="line-clamp-3 text-[12px] leading-6 text-secondary">{discussion.bodyExcerpt}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-tertiary">
          {discussion.language ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
              <Code2 aria-hidden="true" className="h-3 w-3" />
              {discussion.language}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
            <Star aria-hidden="true" className="h-3 w-3" />
            {discussion.stars.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
            <MessagesSquare aria-hidden="true" className="h-3 w-3" />
            {discussion.comments}
          </span>
          {discussion.category ? (
            <span className="rounded-full border border-border bg-surface px-2 py-0.5">{discussion.category}</span>
          ) : null}
        </div>
      </button>
    </Card>
  );
}

function DiscussionDrawer({
  discussion,
  draft,
  copied,
  onClose,
  onDraft,
  onCopyAndOpen
}: {
  discussion: Discussion;
  draft: DraftState;
  copied: boolean;
  onClose: () => void;
  onDraft: () => void;
  onCopyAndOpen: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid grid-rows-[1fr_auto] bg-bg/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto w-full max-w-4xl overflow-y-auto px-6 pb-6 pt-12">
        <Card className="grid gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-mono text-tertiary">
                {discussion.owner}/{discussion.repo} · discussion #{discussion.number}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-primary">{discussion.title}</h2>
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
            {discussion.bodyExcerpt}
          </pre>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="secondary">
              <a href={discussion.url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                Open on GitHub
              </a>
            </Button>
            {draft.status === "idle" || draft.status === "error" ? (
              <Button onClick={onDraft} size="sm">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                Draft an answer with AI
              </Button>
            ) : null}
            {draft.status === "drafting" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-muted bg-accent-muted/40 px-3 py-1 text-[11px] text-accent">
                <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                Drafting…
              </span>
            ) : null}
          </div>

          {draft.status === "drafting" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="grid gap-1.5 rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-6 text-secondary">
                <p className="text-[10px] uppercase tracking-[0.06em] text-tertiary">Pipeline</p>
                {draft.logs.map((log, i) => (
                  <div key={`${i}-${log}`} className="flex items-start gap-2">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    <span>{log}</span>
                  </div>
                ))}
              </div>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-[11.5px] leading-6 text-primary">
                {draft.tokens}
              </pre>
            </div>
          ) : null}

          {draft.status === "error" ? (
            <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{draft.message}</p>
            </div>
          ) : null}

          {draft.status === "ready" ? (
            <div className="grid gap-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-tertiary">Drafted answer (markdown)</p>
              <textarea
                defaultValue={draft.answer}
                spellCheck={false}
                className="min-h-[420px] w-full rounded-md border border-border bg-surface p-3 font-mono text-[11.5px] leading-6 text-primary outline-none transition-colors focus:border-accent"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={onCopyAndOpen}>
                  {copied ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
                  {copied ? "Copied — opening" : "Copy & open in GitHub"}
                </Button>
                <p className="text-[11px] text-tertiary">
                  Review on GitHub before posting. Posting from inside the lab would skip your judgement.
                </p>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
