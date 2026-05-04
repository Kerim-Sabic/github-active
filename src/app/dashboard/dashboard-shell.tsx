"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Code2,
  Database,
  Eye,
  Github,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TimerReset,
  Zap
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { type DashboardData } from "@/server/db/demo-data";
import { GeneratedCommitSchema, type GeneratedCommit } from "@/server/automation/types";

type ToastState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function DashboardShell({ data, isDemo }: { data: DashboardData; isDemo: boolean }) {
  const [schedules, setSchedules] = useState(data.schedules);
  const [selectedScheduleId, setSelectedScheduleId] = useState(data.schedules[0]?.id ?? "");
  const [preview, setPreview] = useState<GeneratedCommit | null>(null);
  const [toast, setToast] = useState<ToastState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId) ?? schedules[0];
  const heatmapCells = useMemo(() => buildHeatmapCells(), []);

  function handlePreview() {
    if (!selectedSchedule) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/preview-commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: selectedSchedule.config })
        });
        const raw: unknown = await response.json();
        const commit = parseGeneratedCommit(raw);
        setPreview(commit);
        setToast({ status: "success", message: "Preview generated from the deterministic schedule seed." });
      } catch (error) {
        setToast({ status: "error", message: error instanceof Error ? error.message : "Preview failed." });
      }
    });
  }

  function handleRunNow() {
    if (!selectedSchedule) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/run-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: selectedSchedule.id })
        });
        if (!response.ok) throw new Error(await response.text());
        setToast({ status: "success", message: isDemo ? "Demo mode: run-now endpoint shape is ready." : "Commit job queued." });
      } catch (error) {
        setToast({ status: "error", message: error instanceof Error ? error.message : "Run failed." });
      }
    });
  }

  function handlePause(scheduleId: string, paused: boolean) {
    const previous = schedules;
    setSchedules((items) => items.map((item) => (item.id === scheduleId ? { ...item, enabled: !paused } : item)));

    startTransition(async () => {
      try {
        const response = await fetch(`/api/schedules/${scheduleId}/pause`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused })
        });
        if (!response.ok && !isDemo) throw new Error(await response.text());
        setToast({ status: "success", message: paused ? "Schedule paused." : "Schedule resumed." });
      } catch (error) {
        setSchedules(previous);
        setToast({ status: "error", message: error instanceof Error ? error.message : "Schedule update failed." });
      }
    });
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-surface-raised">
              <Activity aria-hidden="true" className="h-5 w-5 text-accent" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-primary">GitHub Active Console</h1>
              <p className="text-sm text-secondary">
                {isDemo ? "Demo dashboard. Connect GitHub to persist schedules." : `Signed in as ${data.user.login}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary">
              <a href="/api/github/install">
                <Github aria-hidden="true" className="h-4 w-4" />
                Connect GitHub
              </a>
            </Button>
            <Button onClick={handleRunNow} loading={isPending} title="Queue an immediate transparent journal commit">
              <Play aria-hidden="true" className="h-4 w-4" />
              Run now
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader title="Repositories" eyebrow="GitHub App" />
            <div className="grid gap-2">
              {data.repositories.map((repo) => (
                <button
                  key={repo.id}
                  className="flex min-h-12 items-center justify-between rounded-md border border-border bg-surface px-3 text-left text-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  type="button"
                >
                  <span>
                    <span className="block font-medium text-primary">{repo.fullName}</span>
                    <span className="font-mono text-xs text-tertiary">{repo.defaultBranch}</span>
                  </span>
                  <Badge tone={repo.private ? "warning" : "success"}>{repo.private ? "Private" : "Public"}</Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Schedule" eyebrow="Automation" />
            <div className="grid gap-2">
              {schedules.map((schedule) => (
                <button
                  key={schedule.id}
                  className="rounded-md border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  type="button"
                  onClick={() => setSelectedScheduleId(schedule.id)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-primary">{schedule.name}</span>
                    <Badge tone={schedule.enabled ? "success" : "warning"}>{schedule.enabled ? "Active" : "Paused"}</Badge>
                  </span>
                  <span className="mt-2 block font-mono text-xs text-tertiary">{new Date(schedule.nextRunAt).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <section className="grid gap-5">
          {toast.status !== "idle" ? (
            <div
              className={`rounded-lg border p-4 text-sm ${
                toast.status === "success"
                  ? "border-success-muted bg-success-muted text-success"
                  : "border-danger bg-surface-raised text-primary"
              }`}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard icon={TimerReset} label="Next run" value={selectedSchedule ? timeUntil(selectedSchedule.nextRunAt) : "--"} />
            <MetricCard icon={Code2} label="Tracks" value={selectedSchedule?.config.tracks.length.toString() ?? "--"} />
            <MetricCard icon={Zap} label="Intensity" value={selectedSchedule?.config.intensity ?? "--"} />
            <MetricCard icon={ShieldCheck} label="Catch-up" value={selectedSchedule?.config.catchUpPolicy ?? "--"} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader
                title="Activity Heatmap"
                eyebrow="Preview"
                action={<Badge tone="accent">{selectedSchedule?.repoFullName ?? "No repo"}</Badge>}
              />
              <div className="grid grid-cols-7 gap-2">
                {heatmapCells.map((cell) => (
                  <div
                    key={cell.key}
                    className="h-9 rounded-md border border-border"
                    title={cell.title}
                    style={{ background: cell.background }}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-secondary">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-success-muted" /> Planned
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-accent-muted" /> Rare focus window
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-surface-muted" /> Quiet
                </span>
              </div>
            </Card>

            <Card>
              <CardHeader title="Controls" eyebrow="Runbook" />
              <div className="grid gap-3">
                <Button onClick={handlePreview} variant="secondary" loading={isPending}>
                  <Eye aria-hidden="true" className="h-4 w-4" />
                  Preview next commit
                </Button>
                {selectedSchedule ? (
                  <Button
                    onClick={() => handlePause(selectedSchedule.id, selectedSchedule.enabled)}
                    variant="secondary"
                    loading={isPending}
                    title={selectedSchedule.enabled ? "Pause the selected schedule" : "Resume the selected schedule"}
                  >
                    {selectedSchedule.enabled ? <Pause aria-hidden="true" className="h-4 w-4" /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
                    {selectedSchedule.enabled ? "Pause schedule" : "Resume schedule"}
                  </Button>
                ) : null}
                <Button onClick={handleRunNow} loading={isPending}>
                  <Play aria-hidden="true" className="h-4 w-4" />
                  Queue run now
                </Button>
              </div>

              <div className="mt-5 grid gap-4 border-t border-border pt-5">
                <Input label="Author email" value={selectedSchedule?.config.authorEmail ?? ""} readOnly helper="Must be verified on GitHub." />
                <label className="grid gap-2 text-sm text-secondary">
                  <span className="flex items-center gap-2 font-medium text-primary">
                    <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                    Max daily commits
                  </span>
                  <input
                    aria-label="Max daily commits"
                    className="accent-[var(--color-accent)]"
                    max={12}
                    min={1}
                    readOnly
                    type="range"
                    value={selectedSchedule?.config.maxDailyCommits ?? 4}
                  />
                </label>
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader title="Recent Runs" eyebrow="Audit" />
              <div className="grid gap-3">
                {data.recentRuns.map((run) => (
                  <div key={run.id} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <div>
                      <p className="text-sm font-medium text-primary">{run.message}</p>
                      <p className="mt-1 font-mono text-xs text-tertiary">
                        {run.status} / {new Date(run.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Commit Preview" eyebrow="Deterministic" action={<Settings2 aria-hidden="true" className="h-5 w-5 text-tertiary" />} />
              {preview ? (
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="accent">{preview.kind}</Badge>
                    <Badge tone="neutral">{preview.track}</Badge>
                    <Badge tone="success">{preview.path}</Badge>
                  </div>
                  <p className="text-sm font-medium text-primary">{preview.message}</p>
                  <pre className="max-h-[360px] overflow-auto rounded-md border border-border bg-surface p-4 font-mono text-xs leading-6 text-secondary">
                    {preview.content}
                  </pre>
                </div>
              ) : (
                <div className="grid min-h-[240px] place-items-center rounded-md border border-dashed border-border bg-surface p-6 text-center">
                  <div>
                    <Database aria-hidden="true" className="mx-auto mb-4 h-8 w-8 text-accent" />
                    <p className="font-medium text-primary">No preview generated yet</p>
                    <p className="mt-2 max-w-sm text-sm text-secondary">
                      Generate a preview to inspect the exact file path, message, and content before a worker commits it.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <Card className="p-4">
      <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-accent" />
      <p className="font-mono text-xl text-primary">{value}</p>
      <p className="mt-1 text-sm text-secondary">{label}</p>
    </Card>
  );
}

function buildHeatmapCells() {
  return Array.from({ length: 70 }, (_, index) => {
    const isActive = index % 7 !== 0 && index % 11 !== 0;
    const isRare = index % 17 === 0;

    return {
      key: `cell-${index}`,
      title: isRare ? "Rare focus window" : isActive ? "Planned activity" : "Quiet day",
      background: isRare ? "var(--color-accent-muted)" : isActive ? "var(--color-success-muted)" : "var(--color-surface-muted)"
    };
  });
}

function timeUntil(isoDate: string): string {
  const delta = new Date(isoDate).getTime() - Date.now();
  if (delta <= 0) return "due";

  const minutes = Math.round(delta / 60000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

function parseGeneratedCommit(raw: unknown): GeneratedCommit {
  if (!raw || typeof raw !== "object" || !("commit" in raw)) throw new Error("Preview response was invalid.");
  return GeneratedCommitSchema.parse(raw.commit);
}
