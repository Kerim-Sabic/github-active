"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Github,
  Info,
  Link2,
  LogIn,
  Play,
  RefreshCcw,
  Sparkles,
  Square,
  Star,
  Users
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import {
  type AchievementAutomation,
  type AchievementGoal,
  achievementGoals,
  manualAchievements,
  socialAchievements
} from "@/shared/achievement-goals";
import { ProfileReadmeForm } from "./profile-readme-form";
import { SupporterModal } from "./supporter-modal";

const automatableAchievements = achievementGoals.filter(
  (goal): goal is AchievementGoal & { automation: AchievementAutomation } =>
    goal.kind === "automatable" && Boolean(goal.automation)
);

type LogEntry = {
  id: string;
  kind: "step" | "done" | "error" | "info";
  ts: string;
  message: string;
  url?: string;
};

type RunState =
  | { status: "idle" }
  | { status: "running"; achievement: AchievementAutomation }
  | { status: "complete"; achievement: AchievementAutomation; profileUrl?: string }
  | { status: "failed"; achievement: AchievementAutomation; reason?: string };

type AchievementStatus = {
  sandboxExists: boolean;
  sandboxUrl?: string;
  mergedPullRequests: number;
  mergedPullRequestsWithoutReview: number;
  closedIssuesUnder5min: number;
  coAuthoredCommits: number;
  tiers: {
    pullShark: { reached: number | null; next: number | null; all: number[] };
    yolo: boolean;
    quickdraw: boolean;
    pair: boolean;
  };
};

const PR_PER_CLICK_CAP = 16;

export function AchievementLabClient({
  authedLogin,
  avatarUrl,
  pairFromUrl
}: {
  authedLogin: string | null;
  avatarUrl: string | null;
  pairFromUrl: string | null;
}) {
  const [pairWith, setPairWith] = useState(pairFromUrl ?? "");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [runState, setRunState] = useState<RunState>({ status: "idle" });
  const [achievementStatus, setAchievementStatus] = useState<AchievementStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [supporter, setSupporter] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isRunning = runState.status === "running";

  const appendLog = useCallback((entry: Omit<LogEntry, "id" | "ts">) => {
    setLogs((current) => [
      ...current,
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: new Date().toLocaleTimeString([], { hour12: false })
      }
    ]);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!authedLogin) return;
    setStatusLoading(true);
    try {
      const response = await fetch("/api/achievements/status", { cache: "no-store" });
      if (!response.ok) return;
      const raw = (await response.json()) as AchievementStatus;
      setAchievementStatus(raw);
    } finally {
      setStatusLoading(false);
    }
  }, [authedLogin]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    appendLog({ kind: "info", message: "run cancelled" });
    setRunState({ status: "idle" });
  }, [appendLog]);

  const run = useCallback(
    async (achievement: AchievementAutomation, count?: number) => {
      if (!authedLogin) return;
      if (achievement === "pair-extraordinaire" && pairWith.trim().length === 0) {
        appendLog({ kind: "error", message: "Enter a partner GitHub username before running Pair Extraordinaire." });
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setLogs([]);
      setRunState({ status: "running", achievement });
      appendLog({ kind: "info", message: `starting ${achievement}` });

      try {
        const response = await fetch("/api/achievements/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            achievement,
            count: achievement === "pull-shark" || achievement === "yolo" ? count : undefined,
            pairWith: achievement === "pair-extraordinaire" ? pairWith.trim() : undefined
          }),
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          const error = await safelyReadError(response);
          appendLog({ kind: "error", message: error });
          setRunState({ status: "failed", achievement, reason: error });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let separator = buffer.indexOf("\n\n");
          while (separator !== -1) {
            const chunk = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            handleSseChunk(chunk, appendLog, (state) => setRunState(state), achievement);
            separator = buffer.indexOf("\n\n");
          }
        }

        setRunState((current) =>
          current.status === "running" && current.achievement === achievement
            ? { status: "complete", achievement }
            : current
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        const message = error instanceof Error ? error.message : "run failed";
        appendLog({ kind: "error", message });
        setRunState({ status: "failed", achievement, reason: message });
      } finally {
        abortRef.current = null;
        // Refresh status after every run so progress bars reflect new merges.
        setTimeout(() => refreshStatus(), 1500);
      }
    },
    [appendLog, authedLogin, pairWith, refreshStatus]
  );

  const copyInvite = useCallback(async () => {
    if (!authedLogin) return;
    const url = `${window.location.origin}/achievements?pair=${encodeURIComponent(authedLogin)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — surface a manual copy fallback.
      window.prompt("Copy your pair invite link:", url);
    }
  }, [authedLogin]);

  return (
    <div className="grid gap-10">
      <SupporterModal active={Boolean(authedLogin)} onSupporter={setSupporter} />

      <header className="grid gap-3 md:flex md:items-end md:justify-between">
        <div>
          <Badge tone="success" className="mb-3 inline-flex">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success" />
            Achievement Lab
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">
            Click. Earn. Repeat.
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-7 text-secondary">
            Each Run button performs the real GitHub actions for that achievement, in your{" "}
            <span className="font-mono text-primary">github-active-sandbox</span> repo.
          </p>
        </div>
        <SignedInPill login={authedLogin} avatarUrl={avatarUrl} supporter={supporter} />
      </header>

      {!authedLogin ? <SignInBanner /> : null}

      {pairFromUrl && authedLogin ? <PairInviteBanner login={pairFromUrl} /> : null}

      {achievementStatus ? (
        <ProgressOverview
          status={achievementStatus}
          loading={statusLoading}
          onRefresh={refreshStatus}
          authedLogin={authedLogin}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {automatableAchievements.map((goal) => (
            <AutomatableCard
              key={goal.id}
              goal={goal}
              authed={Boolean(authedLogin)}
              isRunning={isRunning && runState.status === "running" && runState.achievement === goal.automation}
              isOtherRunning={isRunning && (runState.status !== "running" || runState.achievement !== goal.automation)}
              onRun={(count) => run(goal.automation, count)}
              pairWith={pairWith}
              onPairWithChange={setPairWith}
              onCopyInvite={copyInvite}
              copied={copied}
              status={achievementStatus}
              completed={runState.status === "complete" && runState.achievement === goal.automation}
              failed={runState.status === "failed" && runState.achievement === goal.automation}
            />
          ))}
        </div>

        <RunConsole logs={logs} state={runState} onCancel={cancelRun} />
      </section>

      <SocialSection />

      <ManualSection authedLogin={authedLogin} />
    </div>
  );
}

function ProgressOverview({
  status,
  loading,
  onRefresh,
  authedLogin
}: {
  status: AchievementStatus;
  loading: boolean;
  onRefresh: () => void;
  authedLogin: string | null;
}) {
  const ps = status.tiers.pullShark;
  const towardNext = ps.next ? Math.min(status.mergedPullRequests / ps.next, 1) : 1;
  return (
    <Card className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-tertiary">Sandbox progress</p>
          <p className="mt-0.5 text-[13px] font-semibold text-primary">
            {status.sandboxExists
              ? <>Live in <span className="font-mono">{authedLogin}/github-active-sandbox</span></>
              : "Sandbox repo will be created on first run"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.sandboxUrl ? (
            <Button asChild size="sm" variant="secondary">
              <a href={status.sandboxUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                Sandbox
              </a>
            </Button>
          ) : null}
          <Button onClick={onRefresh} loading={loading} size="sm" variant="secondary">
            <RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>
      <div className="grid gap-2.5 md:grid-cols-4">
        <Stat label="Merged PRs" value={status.mergedPullRequests} />
        <Stat label="YOLO eligible" value={status.tiers.yolo ? "yes" : "no"} ok={status.tiers.yolo} />
        <Stat label="Quickdraw" value={status.tiers.quickdraw ? "earned" : "not yet"} ok={status.tiers.quickdraw} />
        <Stat label="Co-authored" value={status.coAuthoredCommits} ok={status.tiers.pair} />
      </div>
      <div className="mt-2 grid gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-secondary">
            Pull Shark · {status.mergedPullRequests} merged
            {ps.next ? ` · next tier ${ps.next}` : " · maxed"}
          </span>
          <span className="font-mono text-tertiary">
            {ps.all.map((tier) => `${status.mergedPullRequests >= tier ? "✓" : "·"} ${tier}`).join("  ")}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${Math.round(towardNext * 100)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, ok }: { label: string; value: number | string; ok?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.06em] text-tertiary">{label}</p>
      <p className={`mt-1 font-mono text-[15px] ${ok ? "text-success" : "text-primary"}`}>{value}</p>
    </div>
  );
}

function PairInviteBanner({ login }: { login: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-accent-muted bg-accent-muted/40 px-5 py-4 text-[13px] text-primary">
      <Link2 aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
      <p>
        <span className="font-medium">@{login}</span> invited you to pair.{" "}
        <span className="text-secondary">Click <span className="font-mono">Run Pair Extraordinaire</span> below to mutually earn the badge.</span>
      </p>
    </div>
  );
}

function handleSseChunk(
  chunk: string,
  appendLog: (entry: Omit<LogEntry, "id" | "ts">) => void,
  setState: (state: RunState) => void,
  achievement: AchievementAutomation
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

  if (event === "step") {
    appendLog({ kind: "step", message, url });
  } else if (event === "error") {
    const reason = `${typeof payload.status === "number" ? `[${payload.status}] ` : ""}${message}`;
    appendLog({ kind: "error", message: reason });
    setState({ status: "failed", achievement, reason });
  } else if (event === "done") {
    appendLog({ kind: "done", message });
    setState({
      status: "complete",
      achievement,
      profileUrl: typeof payload.profileUrl === "string" ? payload.profileUrl : undefined
    });
  }
}

async function safelyReadError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; reason?: string };
    if (body.reason === "reauth_required") {
      return "Session expired or no GitHub repo scope. Sign in again.";
    }
    return body.error ?? `request failed (${response.status})`;
  } catch {
    return `request failed (${response.status})`;
  }
}

function SignedInPill({ login, avatarUrl, supporter }: { login: string | null; avatarUrl: string | null; supporter: boolean }) {
  if (!login) {
    return (
      <Button asChild size="sm">
        <a href="/api/supabase/github">
          <Github aria-hidden="true" className="h-3.5 w-3.5" />
          Sign in with GitHub
        </a>
      </Button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface-raised/80 px-3 py-1.5 backdrop-blur-[2px]">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 rounded-full border border-border"
        />
      ) : (
        <span className="grid h-5 w-5 place-items-center rounded-full border border-border bg-surface text-tertiary">
          <Github aria-hidden="true" className="h-3 w-3" />
        </span>
      )}
      <span className="text-[12px] font-medium text-primary">@{login}</span>
      {supporter ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-success-muted bg-success-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-success">
          <Star aria-hidden="true" className="h-2.5 w-2.5" />
          Supporter
        </span>
      ) : null}
    </div>
  );
}

function SignInBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning-muted bg-warning-muted/40 px-5 py-4 text-[13px] text-primary md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <LogIn aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium">Sign in with GitHub to enable the Run buttons.</p>
          <p className="mt-1 text-[12px] text-secondary">
            The lab needs the <span className="font-mono">repo</span> scope so it can create branches, open PRs, and
            merge them in your sandbox repo. The token stays in your Supabase session cookie.
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
  );
}

function AutomatableCard({
  goal,
  authed,
  isRunning,
  isOtherRunning,
  onRun,
  pairWith,
  onPairWithChange,
  onCopyInvite,
  copied,
  status,
  completed,
  failed
}: {
  goal: AchievementGoal & { automation: AchievementAutomation };
  authed: boolean;
  isRunning: boolean;
  isOtherRunning: boolean;
  onRun: (count?: number) => void;
  pairWith: string;
  onPairWithChange: (value: string) => void;
  onCopyInvite: () => void;
  copied: boolean;
  status: AchievementStatus | null;
  completed: boolean;
  failed: boolean;
}) {
  const Icon = goal.icon;
  const supportsTiers = goal.automation === "pull-shark";
  const supportsPair = goal.automation === "pair-extraordinaire";

  let earned = false;
  if (status) {
    if (goal.automation === "pull-shark") earned = status.tiers.pullShark.reached !== null;
    else if (goal.automation === "yolo") earned = status.tiers.yolo;
    else if (goal.automation === "quickdraw") earned = status.tiers.quickdraw;
    else if (goal.automation === "pair-extraordinaire") earned = status.tiers.pair;
  }

  return (
    <Card className="grid content-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-accent">
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-primary">{goal.title}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-tertiary">{goal.label}</p>
          </div>
        </div>
        <Badge tone={completed || earned ? "success" : failed ? "danger" : "accent"}>
          {completed || earned ? "Earned" : failed ? "Failed" : "Auto"}
        </Badge>
      </div>

      <p className="text-[12px] leading-6 text-secondary">{goal.signal}</p>

      {supportsTiers && status ? (
        <PullSharkTiers status={status} />
      ) : null}

      <div className="grid gap-3 border-t border-border pt-4">
        {supportsPair ? (
          <>
            <Input
              label="Co-author GitHub username"
              placeholder="octocat"
              value={pairWith}
              onChange={(event) => onPairWithChange(event.target.value)}
              disabled={!authed || isRunning}
              helper="Their public profile is fetched to build the Co-authored-by trailer."
            />
            <button
              type="button"
              onClick={onCopyInvite}
              disabled={!authed}
              className="inline-flex items-center justify-center gap-2 self-start rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] text-secondary transition-colors hover:bg-surface-hover hover:text-primary disabled:opacity-60"
            >
              {copied ? <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-success" /> : <Copy aria-hidden="true" className="h-3 w-3" />}
              {copied ? "Copied" : "Copy invite link"}
            </button>
          </>
        ) : null}

        {supportsTiers ? (
          <PullSharkRunButtons
            authed={authed}
            isRunning={isRunning}
            isOtherRunning={isOtherRunning}
            onRun={onRun}
            status={status}
          />
        ) : (
          <Button
            onClick={() => onRun()}
            disabled={!authed || isRunning || isOtherRunning}
            loading={isRunning}
            className="w-full"
          >
            {!isRunning ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : null}
            {isRunning ? "Running..." : authed ? `Run ${goal.title}` : "Sign in to run"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function PullSharkTiers({ status }: { status: AchievementStatus }) {
  const merged = status.mergedPullRequests;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status.tiers.pullShark.all.map((tier) => {
        const reached = merged >= tier;
        return (
          <span
            key={tier}
            className={`inline-flex h-5 items-center gap-1 rounded-full border px-2 font-mono text-[10px] ${
              reached
                ? "border-success-muted bg-success-muted/50 text-success"
                : "border-border bg-surface text-tertiary"
            }`}
          >
            {reached ? "✓" : ""}{tier}
          </span>
        );
      })}
    </div>
  );
}

function PullSharkRunButtons({
  authed,
  isRunning,
  isOtherRunning,
  onRun,
  status
}: {
  authed: boolean;
  isRunning: boolean;
  isOtherRunning: boolean;
  onRun: (count: number) => void;
  status: AchievementStatus | null;
}) {
  const merged = status?.mergedPullRequests ?? 0;
  const next = status?.tiers.pullShark.next ?? 1;
  const remaining = Math.max(0, next - merged);
  const advance = Math.min(remaining || PR_PER_CLICK_CAP, PR_PER_CLICK_CAP);

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          onClick={() => onRun(1)}
          disabled={!authed || isRunning || isOtherRunning}
          variant="secondary"
          size="sm"
        >
          +1
        </Button>
        <Button
          onClick={() => onRun(Math.min(advance, PR_PER_CLICK_CAP))}
          disabled={!authed || isRunning || isOtherRunning || advance === 0}
          variant="secondary"
          size="sm"
        >
          +{advance || 0}{remaining > 0 && remaining > advance ? "*" : ""}
        </Button>
        <Button
          onClick={() => onRun(PR_PER_CLICK_CAP)}
          disabled={!authed || isRunning || isOtherRunning}
          variant="secondary"
          size="sm"
        >
          +{PR_PER_CLICK_CAP}
        </Button>
      </div>
      <Button
        onClick={() => onRun(advance || 2)}
        disabled={!authed || isRunning || isOtherRunning}
        loading={isRunning}
        className="w-full"
      >
        {!isRunning ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : null}
        {isRunning
          ? "Running..."
          : authed
            ? remaining > 0
              ? `Run toward ${next} (${advance} this click)`
              : "Run Pull Shark"
            : "Sign in to run"}
      </Button>
      {remaining > 0 && remaining > PR_PER_CLICK_CAP ? (
        <p className="text-[10px] text-tertiary">
          * Per-click cap is {PR_PER_CLICK_CAP} PRs to stay under GitHub&apos;s abuse limits. Click again to keep going.
        </p>
      ) : null}
    </div>
  );
}

function RunConsole({
  logs,
  state,
  onCancel
}: {
  logs: LogEntry[];
  state: RunState;
  onCancel: () => void;
}) {
  return (
    <Card className="grid content-start gap-3 xl:sticky xl:top-6">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-accent">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-primary">Run console</p>
            <p className="font-mono text-[10px] text-tertiary">live SSE stream</p>
          </div>
        </div>
        {state.status === "running" ? (
          <Button onClick={onCancel} size="sm" variant="secondary">
            <Square aria-hidden="true" className="h-3 w-3" />
            Cancel
          </Button>
        ) : null}
      </div>

      <div className="grid max-h-[420px] gap-1.5 overflow-y-auto rounded-md border border-border bg-surface p-3 font-mono text-[11.5px] leading-6">
        {logs.length === 0 ? (
          <p className="text-tertiary">Waiting for a run.</p>
        ) : (
          logs.map((log) => <LogLine key={log.id} log={log} />)
        )}
      </div>

      {state.status === "complete" ? (
        <div className="rounded-md border border-success-muted bg-success-muted/50 px-3 py-2 text-[12px] text-success">
          <div className="flex items-start gap-2">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="grid gap-1">
              <p className="font-medium">Run complete.</p>
              <p className="text-secondary">
                GitHub typically awards the achievement within 15 minutes.{" "}
                {state.profileUrl ? (
                  <a className="text-primary underline" href={state.profileUrl} target="_blank" rel="noreferrer">
                    Open your profile
                  </a>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {state.status === "failed" ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          <div className="flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{state.reason ?? "Run failed."}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function LogLine({ log }: { log: LogEntry }) {
  const accent =
    log.kind === "done"
      ? "text-success"
      : log.kind === "error"
        ? "text-danger"
        : log.kind === "info"
          ? "text-accent"
          : "text-secondary";

  return (
    <div className="flex items-start gap-3">
      <span className="text-tertiary">{log.ts}</span>
      <div className="grid gap-0.5">
        <span className={accent}>{log.message}</span>
        {log.url ? (
          <a
            href={log.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-tertiary underline-offset-2 hover:text-secondary hover:underline"
          >
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
            {log.url}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SocialSection() {
  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-3">
        <Badge tone="warning">Social</Badge>
        <h2 className="text-base font-semibold text-primary">Need other humans — can&apos;t be automated</h2>
      </div>
      <p className="max-w-3xl text-[12px] leading-6 text-secondary">
        These achievements depend on real people. The lab points you at the legitimate way to earn each one rather
        than pretending to fake it. Looking for a partner for{" "}
        <span className="font-medium text-primary">Pair Extraordinaire</span>? Use the{" "}
        <a href="/coop" className="text-accent hover:underline"><Users className="mr-0.5 inline h-3 w-3" />Pair Board</a>.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {socialAchievements.map((goal) => {
          const Icon = goal.icon;
          return (
            <Card key={goal.id} className="grid content-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-tertiary">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-primary">{goal.title}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-tertiary">{goal.label}</p>
                </div>
              </div>
              <p className="text-[12px] leading-6 text-secondary">{goal.signal}</p>
              {goal.socialReason ? (
                <p className="rounded-md border border-warning-muted bg-warning-muted/30 px-3 py-2 text-[11.5px] leading-5 text-secondary">
                  <Info aria-hidden="true" className="mr-1.5 inline h-3 w-3 -translate-y-px text-warning" />
                  {goal.socialReason}
                </p>
              ) : null}
              {goal.socialAction ? (
                <Button asChild size="sm" variant="secondary" className="self-start">
                  <a href={goal.socialAction.href} target="_blank" rel="noreferrer">
                    {goal.socialAction.label}
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ManualSection({ authedLogin }: { authedLogin: string | null }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-3">
        <Badge tone="accent">Manual</Badge>
        <h2 className="text-base font-semibold text-primary">Profile polish</h2>
      </div>
      <p className="max-w-3xl text-[12px] leading-6 text-secondary">
        Not auto-earnable badges, but the legitimate signals that make a profile look credible. Use the README writer
        to publish your action plan in <span className="font-mono text-primary">{authedLogin ?? "username"}/{authedLogin ?? "username"}</span>.
      </p>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-3">
          {manualAchievements.map((goal) => {
            const Icon = goal.icon;
            return (
              <Card key={goal.id} className="grid gap-2">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-accent">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-primary">{goal.title}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-tertiary">{goal.label}</p>
                  </div>
                </div>
                <p className="text-[12px] leading-6 text-secondary">{goal.signal}</p>
              </Card>
            );
          })}
        </div>

        <ProfileReadmeForm defaultLogin={authedLogin} />
      </div>
    </section>
  );
}
