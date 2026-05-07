"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Github, LogIn, Play, Square, Users } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { createClient } from "@/utils/supabase/client";

type CoopStatus = {
  configured: boolean;
  state?: "none" | "waiting" | "matched" | "completed";
  queueDepth?: number;
  queueAhead?: number | null;
  rowId?: string | null;
  matchedAt?: string | null;
  completedAt?: string | null;
  selfRanAt?: string | null;
  you?: { login: string; avatarUrl: string | null };
  partner?: { login: string; avatarUrl: string | null } | null;
  message?: string;
};

type LogEntry = { id: string; ts: string; kind: "step" | "done" | "error" | "info"; message: string; url?: string };

export function CoopClient({
  authedLogin,
  authedAvatar
}: {
  authedLogin: string | null;
  authedAvatar: string | null;
}) {
  const [status, setStatus] = useState<CoopStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/coop/status", { cache: "no-store" });
    if (response.status === 401) {
      setStatus({ configured: true, state: "none" });
      return;
    }
    if (!response.ok) return;
    const raw = (await response.json()) as CoopStatus;
    setStatus(raw);
  }, []);

  useEffect(() => {
    if (!authedLogin) return;
    refresh();
  }, [authedLogin, refresh]);

  // Realtime: subscribe to pair_signups changes for this user. When the
  // server flips us to "matched", refresh state without polling.
  useEffect(() => {
    if (!authedLogin || !status?.configured) return;
    let unsub = () => {};
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("pair_signups_self")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "pair_signups" },
          () => refresh()
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "pair_signups" },
          () => refresh()
        )
        .subscribe();
      unsub = () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Supabase realtime not enabled in this project — fall back to polling.
      const interval = setInterval(refresh, 5000);
      unsub = () => clearInterval(interval);
    }
    return unsub;
  }, [authedLogin, status?.configured, refresh]);

  const join = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/coop/join", { method: "POST" });
      if (response.ok) await refresh();
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await fetch("/api/coop/leave", { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  };

  const append = (entry: Omit<LogEntry, "id" | "ts">) =>
    setLogs((current) => [
      ...current,
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: new Date().toLocaleTimeString([], { hour12: false })
      }
    ]);

  const runPairCommit = async () => {
    setLogs([]);
    setDone(false);
    setRunning(true);
    append({ kind: "info", message: "starting pair commit" });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/coop/run", { method: "POST", signal: controller.signal });
      if (!response.ok || !response.body) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        append({ kind: "error", message: err.error ?? `request failed (${response.status})` });
        setRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let separator = buffer.indexOf("\n\n");
        while (separator !== -1) {
          const chunk = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          parseSse(chunk, append, () => setDone(true));
          separator = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      append({ kind: "error", message: error instanceof Error ? error.message : "run failed" });
    } finally {
      setRunning(false);
      abortRef.current = null;
      refresh();
    }
  };

  if (!authedLogin) {
    return (
      <div className="grid gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">Pair Board</h1>
        <div className="flex flex-col gap-3 rounded-lg border border-warning-muted bg-warning-muted/40 px-5 py-4 text-[13px] text-primary md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <LogIn aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium">Sign in with GitHub to join the pair queue.</p>
              <p className="mt-1 text-[12px] text-secondary">
                Two signed-in users get matched and run a mutual Pair Extraordinaire commit.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="md:self-start">
            <a href="/api/supabase/github">
              <Github aria-hidden="true" className="h-3.5 w-3.5" />
              Sign in
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (status && status.configured === false) {
    return (
      <div className="grid gap-6">
        <Header authedLogin={authedLogin} authedAvatar={authedAvatar} />
        <Card className="grid gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-[13px] font-semibold text-primary">Pair Board needs the database</p>
              <p className="mt-1 text-[12px] leading-6 text-secondary">
                {status.message ?? "Set SUPABASE_DATABASE_URL on Netlify and apply drizzle/0001_coop.sql to enable matchmaking."}
                The achievement lab and the pair-invite link still work meanwhile.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary" className="self-start">
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
              Open Supabase dashboard
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Header authedLogin={authedLogin} authedAvatar={authedAvatar} queueDepth={status?.queueDepth ?? 0} />

      <Card className="grid gap-5">
        {!status || status.state === "none" ? (
          <NotInQueueState onJoin={join} busy={busy} />
        ) : null}

        {status?.state === "waiting" ? (
          <WaitingState ahead={status.queueAhead ?? 0} onLeave={leave} busy={busy} />
        ) : null}

        {status?.state === "matched" && status.partner ? (
          <MatchedState
            partner={status.partner}
            onRun={runPairCommit}
            onLeave={leave}
            running={running}
            busy={busy}
          />
        ) : null}

        {status?.state === "completed" && status.partner ? (
          <CompletedState
            partner={status.partner}
            onJoinAgain={join}
            onRunMine={runPairCommit}
            running={running}
            busy={busy}
            selfRan={Boolean(status.selfRanAt)}
          />
        ) : null}
      </Card>

      {(running || logs.length > 0) ? (
        <Card className="grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-primary">Run console</p>
            {running ? (
              <Button onClick={cancel} size="sm" variant="secondary">
                <Square aria-hidden="true" className="h-3 w-3" />
                Cancel
              </Button>
            ) : null}
          </div>
          <div className="grid gap-1.5 rounded-md border border-border bg-surface p-3 font-mono text-[11.5px] leading-6">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <span className="text-tertiary">{log.ts}</span>
                <div className="grid gap-0.5">
                  <span className={
                    log.kind === "done"
                      ? "text-success"
                      : log.kind === "error"
                        ? "text-danger"
                        : log.kind === "info"
                          ? "text-accent"
                          : "text-secondary"
                  }>{log.message}</span>
                  {log.url ? (
                    <a className="inline-flex items-center gap-1 text-tertiary hover:text-secondary hover:underline" href={log.url} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                      {log.url}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {done ? (
            <div className="flex items-start gap-2 rounded-md border border-success-muted bg-success-muted/40 px-3 py-2 text-[12px] text-success">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Both accounts should be credited Pair Extraordinaire within ~15 minutes.</p>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function parseSse(
  chunk: string,
  append: (entry: Omit<LogEntry, "id" | "ts">) => void,
  markDone: () => void
): void {
  const lines = chunk.split("\n");
  let event = "message";
  let dataLine = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(dataLine) as Record<string, unknown>;
  } catch {
    return;
  }
  const message = typeof payload.message === "string" ? payload.message : "";
  const url = typeof payload.url === "string" ? payload.url : undefined;
  if (event === "step") append({ kind: "step", message, url });
  else if (event === "error") append({ kind: "error", message });
  else if (event === "done") {
    append({ kind: "done", message });
    markDone();
  }
}

function Header({
  authedLogin,
  authedAvatar,
  queueDepth = 0
}: {
  authedLogin: string;
  authedAvatar: string | null;
  queueDepth?: number;
}) {
  return (
    <div className="grid gap-3 md:flex md:items-end md:justify-between">
      <div>
        <Badge tone="success" className="mb-3 inline-flex">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success" />
          Pair Board
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">
          Match with another lab user. Both earn Pair Extraordinaire.
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-7 text-secondary">
          You wait. Someone else joins. The app makes a co-authored commit in your sandbox crediting both. GitHub
          gives the badge to author and co-author from the same commit.
        </p>
      </div>
      <div className="flex flex-col items-end gap-2 text-[12px] text-tertiary">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised/80 px-3 py-1.5 backdrop-blur-[2px]">
          {authedAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={authedAvatar} alt="" className="h-5 w-5 rounded-full border border-border" />
          ) : (
            <span className="grid h-5 w-5 place-items-center rounded-full border border-border bg-surface text-tertiary">
              <Github aria-hidden="true" className="h-3 w-3" />
            </span>
          )}
          <span className="text-[12px] font-medium text-primary">@{authedLogin}</span>
        </div>
        <span>{queueDepth} {queueDepth === 1 ? "user" : "users"} currently waiting</span>
      </div>
    </div>
  );
}

function NotInQueueState({ onJoin, busy }: { onJoin: () => void; busy: boolean }) {
  return (
    <div className="grid gap-3 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-surface text-accent">
        <Users aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="text-[14px] font-semibold text-primary">Ready to pair?</p>
      <p className="mx-auto max-w-md text-[12px] leading-6 text-secondary">
        Joining the queue advertises your GitHub login to the next person who joins. They become your co-author on a
        single commit in your sandbox repo. No code is shared — only your username for the trailer.
      </p>
      <Button onClick={onJoin} loading={busy} size="lg" className="mx-auto mt-2">
        <Play aria-hidden="true" className="h-3.5 w-3.5" />
        Join the pair queue
      </Button>
    </div>
  );
}

function WaitingState({ ahead, onLeave, busy }: { ahead: number; onLeave: () => void; busy: boolean }) {
  return (
    <div className="grid gap-3 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-accent-muted bg-accent-muted/40 text-accent">
        <Users aria-hidden="true" className="h-5 w-5 animate-pulse" />
      </span>
      <p className="text-[14px] font-semibold text-primary">Waiting for a partner</p>
      <p className="mx-auto max-w-md text-[12px] leading-6 text-secondary">
        {ahead === 0
          ? "You're at the front of the queue. The next signed-in user who joins is yours."
          : `${ahead} ${ahead === 1 ? "person" : "people"} ahead of you.`}
      </p>
      <Button onClick={onLeave} loading={busy} variant="secondary" size="sm" className="mx-auto mt-2">
        Leave queue
      </Button>
    </div>
  );
}

function MatchedState({
  partner,
  onRun,
  onLeave,
  running,
  busy
}: {
  partner: { login: string; avatarUrl: string | null };
  onRun: () => void;
  onLeave: () => void;
  running: boolean;
  busy: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-success-muted bg-success-muted/40 text-success">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-primary">Matched!</p>
          <p className="mt-1 text-[12px] text-secondary">You&apos;re paired with the user below.</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-surface p-4">
        {partner.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={partner.avatarUrl} alt="" className="h-10 w-10 rounded-full border border-border" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-raised text-tertiary">
            <Github aria-hidden="true" className="h-4 w-4" />
          </span>
        )}
        <div>
          <p className="text-[13px] font-semibold text-primary">@{partner.login}</p>
          <a
            href={`https://github.com/${partner.login}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-tertiary hover:text-secondary hover:underline"
          >
            View profile →
          </a>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Button onClick={onRun} loading={running} disabled={busy}>
          <Play aria-hidden="true" className="h-3.5 w-3.5" />
          Run pair commit
        </Button>
        <Button onClick={onLeave} loading={busy} variant="secondary">
          Skip this match
        </Button>
      </div>
      <p className="text-center text-[11px] text-tertiary">
        Either side clicking Run earns Pair Extraordinaire for both. Skipping returns you to the queue.
      </p>
    </div>
  );
}

function CompletedState({
  partner,
  onJoinAgain,
  onRunMine,
  running,
  busy,
  selfRan
}: {
  partner: { login: string; avatarUrl: string | null };
  onJoinAgain: () => void;
  onRunMine: () => void;
  running: boolean;
  busy: boolean;
  selfRan: boolean;
}) {
  return (
    <div className="grid gap-3 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-success-muted bg-success-muted/40 text-success">
        <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="text-[14px] font-semibold text-primary">Pair completed with @{partner.login}</p>
      <p className="mx-auto max-w-md text-[12px] leading-6 text-secondary">
        Both of you should be credited Pair Extraordinaire within 15 minutes.
        {selfRan
          ? " You also ran your own side, so both accounts have +1 PR each toward Pull Shark."
          : " Click Run my side to ship a co-authored PR in your sandbox too — you both get +1 toward Pull Shark."}
      </p>
      {!selfRan ? (
        <Button onClick={onRunMine} loading={running} disabled={busy} className="mx-auto">
          <Play aria-hidden="true" className="h-3.5 w-3.5" />
          Run my side too
        </Button>
      ) : null}
      <Button onClick={onJoinAgain} loading={busy} variant="secondary" size="sm" className="mx-auto">
        Join queue again
      </Button>
    </div>
  );
}
