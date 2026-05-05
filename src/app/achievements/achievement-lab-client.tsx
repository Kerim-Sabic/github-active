"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Github, KeyRound, Sparkles, Target, XCircle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { achievementGoals, type AchievementGoalId } from "@/shared/achievement-goals";

type ProfileReadmeStatus =
  | { kind: "idle" }
  | { kind: "success"; url: string; login: string }
  | { kind: "error"; message: string };

export function AchievementLabClient() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [headline, setHeadline] = useState("Developer building transparent automation, reliable systems, and polished product interfaces.");
  const [focus, setFocus] = useState("Currently focused on GitHub App authentication, scheduled workers, deterministic previews, and visible engineering audit trails.");
  const [projectUrl, setProjectUrl] = useState("https://githubactive.netlify.app");
  const [selectedGoalIds, setSelectedGoalIds] = useState<AchievementGoalId[]>([
    "profile-readme",
    "repository-credibility",
    "pull-shark"
  ]);
  const [status, setStatus] = useState<ProfileReadmeStatus>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const selectedGoals = achievementGoals.filter((goal) => selectedGoalIds.includes(goal.id));

  function updateProfileReadme() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/achievements/profile-readme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, token, headline, focus, projectUrl, goals: selectedGoalIds })
        });
        const raw = (await response.json()) as { result?: { htmlUrl: string; login: string }; error?: string };
        if (!response.ok || !raw.result) throw new Error(raw.error ?? "Profile README update failed.");
        setStatus({ kind: "success", url: raw.result.htmlUrl, login: raw.result.login });
      } catch (error) {
        setStatus({ kind: "error", message: error instanceof Error ? error.message : "Profile README update failed." });
      }
    });
  }

  function toggleGoal(goalId: AchievementGoalId) {
    setSelectedGoalIds((current) =>
      current.includes(goalId) ? current.filter((id) => id !== goalId) : [...current, goalId]
    );
  }

  return (
    <Card className="shadow-panel">
      <CardHeader
        title="Achievement Goal Planner"
        eyebrow="Choose targets"
        action={<Badge tone="success">{selectedGoalIds.length} selected</Badge>}
      />
      <div className="grid gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Github aria-hidden="true" className="h-4 w-4 text-accent" />
            What this can do safely
          </div>
          <p className="text-sm leading-6 text-secondary">
            Choose the GitHub achievements or profile signals you want to work toward. The app creates a factual profile README
            action plan in your username/username repository. It does not fake stars, reviews, issues, or badge activity.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {achievementGoals.map((goal) => {
            const active = selectedGoalIds.includes(goal.id);
            const Icon = goal.icon;

            return (
              <button
                key={goal.id}
                className={`grid gap-3 rounded-lg border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99] ${
                  active
                    ? "border-success-muted bg-success-muted/55 shadow-active"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover"
                }`}
                type="button"
                onClick={() => toggleGoal(goal.id)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface-raised">
                      <Icon aria-hidden="true" className={active ? "h-4 w-4 text-success" : "h-4 w-4 text-accent"} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-primary">{goal.title}</span>
                      <span className="mt-1 block font-mono text-xs text-tertiary">{goal.label} / {goal.difficulty}</span>
                    </span>
                  </span>
                  {active ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-success" /> : null}
                </span>
                <span className="text-sm leading-6 text-secondary">{goal.signal}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-surface-inset p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Target aria-hidden="true" className="h-4 w-4 text-accent" />
            Selected plan
          </div>
          <div className="grid gap-3">
            {selectedGoals.length ? (
              selectedGoals.map((goal) => (
                <div key={goal.id} className="rounded-md border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-primary">{goal.title}</p>
                    <Badge tone="neutral">{goal.evidence}</Badge>
                  </div>
                  <ul className="mt-3 grid gap-2">
                    {goal.actions.slice(0, 2).map((action) => (
                      <li key={action} className="flex items-start gap-2 text-sm leading-6 text-secondary">
                        <CheckCircle2 aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-success" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-sm text-secondary">Select at least one goal to generate a plan.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="GitHub username" placeholder="octocat" value={username} onChange={(event) => setUsername(event.target.value)} />
          <Input label="Fine-grained token" placeholder="github_pat_..." type="password" value={token} onChange={(event) => setToken(event.target.value)} />
        </div>
        <Input label="Profile headline" value={headline} onChange={(event) => setHeadline(event.target.value)} />
        <label className="grid gap-2 text-sm text-secondary">
          <span className="font-medium text-primary">Current focus</span>
          <textarea
            className="min-h-28 rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-tertiary focus:border-accent focus:ring-2 focus:ring-accent-muted"
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
          />
        </label>
        <Input label="Featured project URL" value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} />
        <Button onClick={updateProfileReadme} loading={isPending} disabled={token.length < 20 || !username || !headline || !focus || selectedGoalIds.length === 0}>
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Publish selected goal plan
        </Button>

        {status.kind === "success" ? (
          <a
            className="flex items-center gap-2 rounded-md border border-success-muted bg-success-muted p-3 text-sm text-success"
            href={status.url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Profile README updated for {status.login}
          </a>
        ) : null}

        {status.kind === "error" ? (
          <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {status.message}
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <KeyRound aria-hidden="true" className="h-4 w-4 text-accent" />
            Token permissions
          </div>
          <p className="text-sm leading-6 text-secondary">
            Use a fine-grained token scoped only to the username/username profile repository with Contents read/write and Metadata read.
            The token is sent once and is not stored. Selected goals are written as a transparent action plan.
          </p>
        </div>
      </div>
    </Card>
  );
}
