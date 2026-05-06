"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Github,
  Info,
  LogIn,
  Play,
  Sparkles,
  Square
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

export function AchievementLabClient({
  authedLogin,
  avatarUrl
}: {
  authedLogin: string | null;
  avatarUrl: string | null;
}) {
  const [count, setCount] = useState(2);
  const [pairWith, setPairWith] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [runState, setRunState] = useState<RunState>({ status: "idle" });
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

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    appendLog({ kind: "info", message: "run cancelled" });
    setRunState({ status: "idle" });
  }, [appendLog]);

  const run = useCallback(
    async (achievement: AchievementAutomation) => {
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
      }
    },
    [appendLog, authedLogin, count, pairWith]
  );

  return (
    <div className="grid gap-10">
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
            Each Run button below performs the real GitHub actions required for that achievement, in your{" "}
            <span className="font-mono text-primary">github-active-sandbox</span> repo.
          </p>
        </div>

        <SignedInPill login={authedLogin} avatarUrl={avatarUrl} />
      </header>

      {!authedLogin ? <SignInBanner /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {automatableAchievements.map((goal) => (
            <AutomatableCard
              key={goal.id}
              goal={goal}
              authed={Boolean(authedLogin)}
              isRunning={isRunning && runState.status === "running" && runState.achievement === goal.automation}
              isOtherRunning={isRunning && (runState.status !== "running" || runState.achievement !== goal.automation)}
              onRun={() => run(goal.automation)}
              count={count}
              onCountChange={setCount}
              pairWith={pairWith}
              onPairWithChange={setPairWith}
              completed={runState.status === "complete" && runState.achievement === goal.automation}
              failed={runState.status === "failed" && runState.achievement === goal.automation}
            />
          ))}
        </div>

        <RunConsole
          logs={logs}
          state={runState}
          onCancel={cancelRun}
        />
      </section>

      <SocialSection />

      <ManualSection authedLogin={authedLogin} />
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

function SignedInPill({ login, avatarUrl }: { login: string | null; avatarUrl: string | null }) {
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
  count,
  onCountChange,
  pairWith,
  onPairWithChange,
  completed,
  failed
}: {
  goal: AchievementGoal & { automation: AchievementAutomation };
  authed: boolean;
  isRunning: boolean;
  isOtherRunning: boolean;
  onRun: () => void;
  count: number;
  onCountChange: (value: number) => void;
  pairWith: string;
  onPairWithChange: (value: string) => void;
  completed: boolean;
  failed: boolean;
}) {
  const Icon = goal.icon;
  const supportsCount = goal.automation === "pull-shark" || goal.automation === "yolo";
  const supportsPair = goal.automation === "pair-extraordinaire";

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
        <Badge tone={completed ? "success" : failed ? "danger" : "accent"}>
          {completed ? "Earned" : failed ? "Failed" : "Auto"}
        </Badge>
      </div>

      <p className="text-[12px] leading-6 text-secondary">{goal.signal}</p>

      {goal.tiers ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {goal.tiers.map((tier) => (
            <span
              key={tier}
              className="inline-flex h-5 items-center rounded-full border border-border bg-surface px-2 font-mono text-[10px] text-tertiary"
            >
              {tier}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 border-t border-border pt-4">
        {supportsCount ? (
          <div className="grid gap-1.5">
            <span className="text-[11px] font-medium text-secondary">PRs to ship in this run</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={16}
                value={count}
                onChange={(event) => onCountChange(Number(event.target.value))}
                disabled={!authed || isRunning}
                className="w-full accent-[var(--color-accent)]"
              />
              <span className="min-w-10 rounded-md border border-border bg-surface px-2 py-1 text-center font-mono text-[12px] text-primary">
                {count}
              </span>
            </div>
          </div>
        ) : null}

        {supportsPair ? (
          <Input
            label="Co-author GitHub username"
            placeholder="octocat"
            value={pairWith}
            onChange={(event) => onPairWithChange(event.target.value)}
            disabled={!authed || isRunning}
            helper="Their public profile is fetched to build the Co-authored-by trailer."
          />
        ) : null}

        <Button
          onClick={onRun}
          disabled={!authed || isRunning || isOtherRunning}
          loading={isRunning}
          className="w-full"
        >
          {!isRunning ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : null}
          {isRunning ? "Running..." : authed ? `Run ${goal.title}` : "Sign in to run"}
        </Button>
      </div>
    </Card>
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

      <div className="grid max-h-[360px] gap-1.5 overflow-y-auto rounded-md border border-border bg-surface p-3 font-mono text-[11.5px] leading-6">
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
        than pretending to fake it.
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

