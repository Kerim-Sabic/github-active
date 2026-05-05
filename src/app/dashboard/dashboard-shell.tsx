"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Code2,
  Database,
  Eye,
  ExternalLink,
  GitBranch,
  Github,
  History,
  Pause,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  TimerReset,
  Wifi,
  XCircle,
  Zap
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActivityBackdrop } from "@/shared/ui/activity-backdrop";
import { type DashboardData } from "@/server/db/demo-data";
import {
  CatchUpPolicySchema,
  GeneratedCommitSchema,
  IntensitySchema,
  type AutomationConfig,
  type GeneratedCommit,
  type Track
} from "@/server/automation/types";
import { type SetupStatus } from "@/server/setup/status";

type ToastState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "warning"; message: string }
  | { status: "error"; message: string };

const weekdays = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" }
];

const tracks: Array<{ value: Track; label: string }> = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "devops", label: "DevOps" },
  { value: "security", label: "Security" },
  { value: "ai", label: "AI" },
  { value: "data", label: "Data" },
  { value: "systems", label: "Systems" }
];

export function DashboardShell({
  data,
  isDemo,
  setup,
  authMode = "demo"
}: {
  data: DashboardData;
  isDemo: boolean;
  setup: SetupStatus;
  authMode?: "demo" | "github-app" | "supabase";
}) {
  const [schedules, setSchedules] = useState(data.schedules);
  const [selectedScheduleId, setSelectedScheduleId] = useState(data.schedules[0]?.id ?? "");
  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId) ?? schedules[0] ?? null;
  const [draftConfig, setDraftConfig] = useState<AutomationConfig | null>(selectedSchedule?.config ?? null);
  const [preview, setPreview] = useState<GeneratedCommit | null>(null);
  const [toast, setToast] = useState<ToastState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const heatmapCells = useMemo(() => buildHeatmapCells(), []);

  function selectSchedule(scheduleId: string) {
    const next = schedules.find((schedule) => schedule.id === scheduleId);
    setSelectedScheduleId(scheduleId);
    setDraftConfig(next?.config ?? null);
    setPreview(null);
  }

  function updateDraft(updater: (config: AutomationConfig) => AutomationConfig) {
    setDraftConfig((current) => (current ? updater(current) : current));
  }

  function handlePreview() {
    if (!draftConfig) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/preview-commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: draftConfig })
        });
        if (!response.ok) throw new Error(await response.text());
        const raw: unknown = await response.json();
        const commit = parseGeneratedCommit(raw);
        setPreview(commit);
        setToast({ status: "success", message: "Preview generated from the exact schedule draft." });
      } catch (error) {
        setToast({ status: "error", message: error instanceof Error ? error.message : "Preview failed." });
      }
    });
  }

  function handleRunNow() {
    if (!selectedSchedule) return;
    if (isDemo) {
      setToast({ status: "warning", message: "Demo mode only previews content. Connect GitHub to queue real commits." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/run-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: selectedSchedule.id })
        });
        if (!response.ok) throw new Error(await response.text());
        setToast({ status: "success", message: "Background commit job queued." });
      } catch (error) {
        setToast({ status: "error", message: error instanceof Error ? error.message : "Run failed." });
      }
    });
  }

  function handlePause(paused: boolean) {
    if (!selectedSchedule) return;
    const previous = schedules;
    setSchedules((items) => items.map((item) => (item.id === selectedSchedule.id ? { ...item, enabled: !paused } : item)));

    if (isDemo) {
      setToast({ status: "warning", message: paused ? "Demo schedule paused locally." : "Demo schedule resumed locally." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/schedules/${selectedSchedule.id}/pause`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused })
        });
        if (!response.ok) throw new Error(await response.text());
        setToast({ status: "success", message: paused ? "Schedule paused." : "Schedule resumed." });
      } catch (error) {
        setSchedules(previous);
        setToast({ status: "error", message: error instanceof Error ? error.message : "Schedule update failed." });
      }
    });
  }

  function handleSaveSchedule() {
    if (!selectedSchedule || !draftConfig) return;
    const parsed = IntensitySchema.safeParse(draftConfig.intensity);
    if (!parsed.success) return;

    const previous = schedules;
    setSchedules((items) =>
      items.map((item) =>
        item.id === selectedSchedule.id
          ? {
              ...item,
              config: draftConfig,
              repoFullName: draftConfig.repo.fullName
            }
          : item
      )
    );

    if (isDemo) {
      setToast({ status: "warning", message: "Demo schedule updated locally. Connect GitHub to persist changes." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/schedules/${selectedSchedule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: draftConfig })
        });
        if (!response.ok) throw new Error(await response.text());
        const raw = (await response.json()) as { schedule?: { enabled: boolean; nextRunAt: string } };
        setSchedules((items) =>
          items.map((item) =>
            item.id === selectedSchedule.id && raw.schedule
              ? { ...item, enabled: raw.schedule.enabled, nextRunAt: raw.schedule.nextRunAt }
              : item
          )
        );
        setToast({ status: "success", message: "Schedule saved and next run recalculated." });
      } catch (error) {
        setSchedules(previous);
        setToast({ status: "error", message: error instanceof Error ? error.message : "Schedule save failed." });
      }
    });
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-surface">
      <ActivityBackdrop density="console" />
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-surface-raised">
              <Activity aria-hidden="true" className="h-5 w-5 text-accent" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-primary">GitHub Active Console</h1>
              <p className="text-sm text-secondary">
                {authMode === "supabase"
                  ? `Signed in with Supabase GitHub as ${data.user.login}. Install the GitHub App or use manual mode for repository writes.`
                  : isDemo
                    ? "Demo surface. Connect GitHub to persist schedules and queue commits."
                    : `Signed in as ${data.user.login}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary">
              <a href="/connect">
                <Github aria-hidden="true" className="h-4 w-4" />
                {isDemo ? "Connect GitHub" : "Reconnect"}
              </a>
            </Button>
            <Button onClick={handlePreview} variant="secondary" loading={isPending} disabled={!draftConfig}>
              <Eye aria-hidden="true" className="h-4 w-4" />
              Preview
            </Button>
            <Button onClick={handleRunNow} loading={isPending} disabled={!selectedSchedule}>
              <Play aria-hidden="true" className="h-4 w-4" />
              Run now
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-5 px-5 py-5 xl:grid-cols-[300px_1fr_368px]">
        <aside className="grid content-start gap-5">
          <ConnectionHealth setup={setup} isDemo={isDemo} repositoryCount={data.repositories.length} />
          <RepositorySelector repositories={data.repositories} />
          <ScheduleSelector
            schedules={schedules}
            selectedScheduleId={selectedSchedule?.id ?? ""}
            onSelect={selectSchedule}
          />
        </aside>

        <section className="grid content-start gap-5">
          <Toast toast={toast} />

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard icon={TimerReset} label="Next run" value={selectedSchedule ? timeUntil(selectedSchedule.nextRunAt) : "--"} />
            <MetricCard icon={Code2} label="Tracks" value={draftConfig?.tracks.length.toString() ?? "--"} />
            <MetricCard icon={Zap} label="Intensity" value={draftConfig?.intensity ?? "--"} />
            <MetricCard icon={ShieldCheck} label="Catch-up" value={draftConfig?.catchUpPolicy ?? "--"} />
          </div>

          <Card className="shadow-panel">
            <CardHeader
              title="Activity Plan"
              eyebrow="Forecast"
              action={<Badge tone="accent">{selectedSchedule?.repoFullName ?? "No repository"}</Badge>}
            />
            <div className="grid grid-flow-col grid-rows-7 gap-1.5 rounded-lg border border-border bg-surface-inset p-3">
              {heatmapCells.map((cell) => (
                <span
                  key={cell.key}
                  className="aspect-square min-h-4 rounded-[4px] border border-border shadow-[inset_0_1px_0_oklch(100%_0_0_/_0.08)]"
                  title={cell.title}
                  style={{ background: cell.background }}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-secondary">
              <Legend color="var(--color-success-muted)" label="Planned" />
              <Legend color="var(--color-accent-muted)" label="Focus window" />
              <Legend color="var(--color-surface-muted)" label="Quiet" />
            </div>
          </Card>

          <ScheduleEditor
            config={draftConfig}
            isPending={isPending}
            onUpdate={updateDraft}
            onSave={handleSaveSchedule}
          />

          <RecentRuns runs={data.recentRuns} />
        </section>

        <aside className="grid content-start gap-5">
          <Runbook
            enabled={selectedSchedule?.enabled ?? false}
            isPending={isPending}
            onPause={() => selectedSchedule ? handlePause(selectedSchedule.enabled) : undefined}
            onPreview={handlePreview}
            onRunNow={handleRunNow}
            hasSchedule={Boolean(selectedSchedule)}
          />
          <PreviewPanel preview={preview} />
        </aside>
      </div>
    </main>
  );
}

function ConnectionHealth({
  setup,
  isDemo,
  repositoryCount
}: {
  setup: SetupStatus;
  isDemo: boolean;
  repositoryCount: number;
}) {
  const ready = setup.canStartGitHubAuth && !isDemo;

  return (
    <Card className="shadow-none">
      <CardHeader
        title="Connection"
        eyebrow="Health"
        action={<Badge tone={ready ? "success" : "warning"}>{ready ? "Live" : "Action"}</Badge>}
      />
      <ActivityMiniGrid />
      <div className="grid gap-3">
        <HealthRow icon={ready ? Wifi : AlertTriangle} label="GitHub App" value={setup.githubReady ? "configured" : "missing config"} tone={setup.githubReady ? "success" : "warning"} />
        <HealthRow icon={Database} label="Database" value={setup.databaseReady ? "connected" : "not configured"} tone={setup.databaseReady ? "success" : "warning"} />
        <HealthRow icon={ShieldCheck} label="Session" value={setup.securityReady ? "signed" : "needs secret"} tone={setup.securityReady ? "success" : "warning"} />
        <HealthRow icon={Github} label="Repositories" value={isDemo ? "demo" : `${repositoryCount} synced`} tone={repositoryCount > 0 ? "success" : "warning"} />
      </div>
      {!setup.canStartGitHubAuth ? (
        <Button asChild variant="secondary" className="mt-4 w-full">
          <a href="/setup">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            View setup checklist
          </a>
        </Button>
      ) : null}
    </Card>
  );
}

function RepositorySelector({ repositories }: { repositories: DashboardData["repositories"] }) {
  return (
    <Card className="shadow-none">
      <CardHeader title="Repositories" eyebrow="GitHub App" />
      <div className="grid gap-2">
        {repositories.length ? (
          repositories.map((repo) => (
            <button
              key={repo.id}
              className="min-h-14 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              type="button"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-primary">{repo.fullName}</span>
                  <span className="mt-1 flex items-center gap-1 font-mono text-xs text-tertiary">
                    <GitBranch aria-hidden="true" className="h-3.5 w-3.5" />
                    {repo.defaultBranch}
                  </span>
                </span>
                <Badge tone={repo.private ? "warning" : "success"}>{repo.private ? "Private" : "Public"}</Badge>
              </span>
            </button>
          ))
        ) : (
          <EmptyState icon={Github} title="No repositories synced" copy="Install the GitHub App and choose at least one repository." />
        )}
      </div>
    </Card>
  );
}

function ScheduleSelector({
  schedules,
  selectedScheduleId,
  onSelect
}: {
  schedules: DashboardData["schedules"];
  selectedScheduleId: string;
  onSelect: (scheduleId: string) => void;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader title="Schedules" eyebrow="Automation" />
      <div className="grid gap-2">
        {schedules.length ? (
          schedules.map((schedule) => (
            <button
              key={schedule.id}
              className={`rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                schedule.id === selectedScheduleId
                  ? "border-accent bg-accent-muted/60"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover"
              }`}
              type="button"
              onClick={() => onSelect(schedule.id)}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-primary">{schedule.name}</span>
                <Badge tone={schedule.enabled ? "success" : "warning"}>{schedule.enabled ? "Active" : "Paused"}</Badge>
              </span>
              <span className="mt-2 block font-mono text-xs text-tertiary">{new Date(schedule.nextRunAt).toLocaleString()}</span>
            </button>
          ))
        ) : (
          <EmptyState icon={CalendarClock} title="No schedules yet" copy="Connect GitHub and create a schedule for a selected repository." />
        )}
      </div>
    </Card>
  );
}

function ScheduleEditor({
  config,
  isPending,
  onUpdate,
  onSave
}: {
  config: AutomationConfig | null;
  isPending: boolean;
  onUpdate: (updater: (config: AutomationConfig) => AutomationConfig) => void;
  onSave: () => void;
}) {
  if (!config) {
    return (
      <Card className="shadow-none">
        <EmptyState icon={SlidersHorizontal} title="Select a schedule" copy="Schedule controls appear after a repository schedule exists." />
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader
        title="Schedule Builder"
        eyebrow="Configuration"
        action={
          <Button onClick={onSave} size="sm" loading={isPending}>
            <Save aria-hidden="true" className="h-4 w-4" />
            Save
          </Button>
        }
      />

      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Timezone"
            value={config.timezone}
            onChange={(event) => onUpdate((current) => ({ ...current, timezone: event.target.value }))}
          />
          <Input
            label="Author email"
            value={config.authorEmail}
            helper="Must be verified on GitHub."
            onChange={(event) => onUpdate((current) => ({ ...current, authorEmail: event.target.value }))}
          />
        </div>

        <ControlGroup icon={CalendarClock} label="Active days">
          <div className="grid grid-cols-7 gap-2">
            {weekdays.map((day) => {
              const active = config.activeDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  className={`h-10 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    active ? "border-accent bg-accent-muted text-accent" : "border-border bg-surface text-secondary hover:bg-surface-hover"
                  }`}
                  onClick={() =>
                    onUpdate((current) => ({
                      ...current,
                      activeDays: toggleNumber(current.activeDays, day.value).sort((a, b) => a - b)
                    }))
                  }
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </ControlGroup>

        <div className="grid gap-5 lg:grid-cols-2">
          <ControlGroup icon={Zap} label="Intensity">
            <SegmentedControl
              values={IntensitySchema.options}
              active={config.intensity}
              onChange={(value) => onUpdate((current) => ({ ...current, intensity: value }))}
            />
          </ControlGroup>

          <ControlGroup icon={RefreshCw} label="Catch-up policy">
            <SegmentedControl
              values={CatchUpPolicySchema.options}
              active={config.catchUpPolicy}
              onChange={(value) => onUpdate((current) => ({ ...current, catchUpPolicy: value }))}
            />
          </ControlGroup>
        </div>

        <ControlGroup icon={SlidersHorizontal} label="Max daily commits">
          <div className="grid gap-3 md:grid-cols-[1fr_72px] md:items-center">
            <input
              aria-label="Max daily commits"
              className="accent-[var(--color-accent)]"
              max={12}
              min={1}
              type="range"
              value={config.maxDailyCommits}
              onChange={(event) => onUpdate((current) => ({ ...current, maxDailyCommits: Number(event.target.value) }))}
            />
            <output className="rounded-md border border-border bg-surface p-2 text-center font-mono text-sm text-primary">
              {config.maxDailyCommits}
            </output>
          </div>
        </ControlGroup>

        <div className="grid gap-5 lg:grid-cols-2">
          <ControlGroup icon={Clock3} label="Quiet hours">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Start"
                value={config.quietHours.start}
                onChange={(value) => onUpdate((current) => ({ ...current, quietHours: { ...current.quietHours, start: value } }))}
              />
              <NumberField
                label="End"
                value={config.quietHours.end}
                onChange={(value) => onUpdate((current) => ({ ...current, quietHours: { ...current.quietHours, end: value } }))}
              />
            </div>
          </ControlGroup>

          <ControlGroup icon={Code2} label="Tracks">
            <div className="flex flex-wrap gap-2">
              {tracks.map((track) => {
                const active = config.tracks.includes(track.value);
                return (
                  <button
                    key={track.value}
                    type="button"
                    className={`min-h-9 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active ? "border-success-muted bg-success-muted text-success" : "border-border bg-surface text-secondary hover:bg-surface-hover"
                    }`}
                    onClick={() =>
                      onUpdate((current) => ({
                        ...current,
                        tracks: toggleTrack(current.tracks, track.value)
                      }))
                    }
                  >
                    {track.label}
                  </button>
                );
              })}
            </div>
          </ControlGroup>
        </div>
      </div>
    </Card>
  );
}

function Runbook({
  enabled,
  isPending,
  onPause,
  onPreview,
  onRunNow,
  hasSchedule
}: {
  enabled: boolean;
  isPending: boolean;
  onPause: () => void;
  onPreview: () => void;
  onRunNow: () => void;
  hasSchedule: boolean;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader title="Runbook" eyebrow="Controls" />
      <div className="grid gap-3">
        <Button onClick={onPreview} variant="secondary" loading={isPending} disabled={!hasSchedule}>
          <Eye aria-hidden="true" className="h-4 w-4" />
          Preview next commit
        </Button>
        <Button onClick={onPause} variant="secondary" loading={isPending} disabled={!hasSchedule}>
          {enabled ? <Pause aria-hidden="true" className="h-4 w-4" /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
          {enabled ? "Pause schedule" : "Resume schedule"}
        </Button>
        <Button onClick={onRunNow} loading={isPending} disabled={!hasSchedule}>
          <Play aria-hidden="true" className="h-4 w-4" />
          Queue run now
        </Button>
      </div>
    </Card>
  );
}

function PreviewPanel({ preview }: { preview: GeneratedCommit | null }) {
  return (
    <Card className="shadow-none xl:sticky xl:top-24">
      <CardHeader title="Commit Preview" eyebrow="Deterministic" action={<Badge tone={preview ? "success" : "neutral"}>{preview ? "Ready" : "Empty"}</Badge>} />
      {preview ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">{preview.kind}</Badge>
            <Badge tone="neutral">{preview.track}</Badge>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="font-mono text-xs text-tertiary">path</p>
            <p className="mt-1 break-all font-mono text-sm text-primary">{preview.path}</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="font-mono text-xs text-tertiary">message</p>
            <p className="mt-1 text-sm font-medium text-primary">{preview.message}</p>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-md border border-border bg-surface p-4 font-mono text-xs leading-6 text-secondary">
            {preview.content}
          </pre>
        </div>
      ) : (
        <EmptyState icon={Database} title="No preview generated" copy="Preview a schedule draft to inspect the exact file path, message, and content before any worker commits it." />
      )}
    </Card>
  );
}

function RecentRuns({ runs }: { runs: DashboardData["recentRuns"] }) {
  return (
    <Card className="shadow-none">
      <CardHeader title="Recent Runs" eyebrow="Audit" action={<History aria-hidden="true" className="h-5 w-5 text-tertiary" />} />
      <div className="grid gap-3">
        {runs.length ? (
          runs.map((run) => (
            <div key={run.id} className="grid gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-start gap-3">
                {run.status === "failed" ? (
                  <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                )}
                <div>
                  <p className="text-sm font-medium text-primary">{run.message}</p>
                  <p className="mt-1 font-mono text-xs text-tertiary">
                    {run.status} / {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {run.githubUrl ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={run.githubUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    Commit
                  </a>
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState icon={History} title="No runs recorded" copy="Completed and failed jobs will appear here with commit links." />
        )}
      </div>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <section className="rounded-lg border border-border bg-surface-raised/92 p-4 shadow-soft backdrop-blur">
      <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-accent" />
      <p className="truncate font-mono text-xl text-primary">{value}</p>
      <p className="mt-1 text-sm text-secondary">{label}</p>
    </section>
  );
}

function HealthRow({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className={`h-4 w-4 ${tone === "success" ? "text-success" : "text-warning"}`} />
        <span className="text-sm text-secondary">{label}</span>
      </div>
      <span className="font-mono text-xs text-primary">{value}</span>
    </div>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (toast.status === "idle") return null;

  const toneClass = {
    success: "border-success-muted bg-success-muted text-success",
    warning: "border-warning-muted bg-warning-muted text-warning",
    error: "border-danger/30 bg-danger/10 text-danger"
  } as const;

  return (
    <div className={`rounded-lg border p-4 text-sm ${toneClass[toast.status]}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}

function ControlGroup({
  icon: Icon,
  label,
  children
}: {
  icon: typeof Activity;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Icon aria-hidden="true" className="h-4 w-4 text-accent" />
        {label}
      </div>
      {children}
    </section>
  );
}

function SegmentedControl<TValue extends string>({
  values,
  active,
  onChange
}: {
  values: readonly TValue[];
  active: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className={`min-h-10 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            value === active ? "border-accent bg-accent-muted text-accent" : "border-border bg-surface text-secondary hover:bg-surface-hover"
          }`}
          onClick={() => onChange(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-secondary">
      <span className="font-medium text-primary">{label}</span>
      <input
        className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-muted"
        max={23}
        min={0}
        type="number"
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value), 0, 23))}
      />
    </label>
  );
}

function EmptyState({
  icon: Icon,
  title,
  copy
}: {
  icon: typeof Activity;
  title: string;
  copy: string;
}) {
  return (
    <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-border bg-surface p-5 text-center">
      <div>
        <Icon aria-hidden="true" className="mx-auto mb-3 h-7 w-7 text-accent" />
        <p className="font-medium text-primary">{title}</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-secondary">{copy}</p>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-sm border border-border" style={{ background: color }} />
      {label}
    </span>
  );
}

function buildHeatmapCells() {
  return Array.from({ length: 7 * 18 }, (_, index) => {
    const week = Math.floor(index / 7);
    const day = index % 7;
    const isQuiet = index % 11 === 0 || index % 19 === 0;
    const isFocus = week % 5 === 0 && day > 1 && day < 6;
    const isPeak = week % 9 === 0 && day % 2 === 0;

    return {
      key: `cell-${index}`,
      title: isQuiet ? "Quiet day" : isFocus ? "Focus window" : "Planned activity",
      background: isQuiet
        ? "var(--color-surface-muted)"
        : isPeak
          ? "var(--color-success)"
          : isFocus
            ? "var(--color-accent-muted)"
            : "var(--color-success-muted)"
    };
  });
}

function ActivityMiniGrid() {
  return (
    <div className="mb-4 grid grid-flow-col grid-rows-7 gap-1 rounded-lg border border-border bg-surface-inset p-3">
      {Array.from({ length: 7 * 9 }, (_, index) => (
        <span
          key={index}
          className={`aspect-square rounded-[3px] border border-border ${
            index % 17 === 0
              ? "bg-success"
              : index % 5 === 0
                ? "bg-success-muted"
                : index % 7 === 0
                  ? "bg-accent-muted"
                  : "bg-surface-muted"
          }`}
        />
      ))}
    </div>
  );
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

function toggleNumber(values: number[], value: number): number[] {
  if (values.includes(value)) {
    return values.length === 1 ? values : values.filter((item) => item !== value);
  }
  return [...values, value];
}

function toggleTrack(values: Track[], value: Track): Track[] {
  if (values.includes(value)) {
    return values.length === 1 ? values : values.filter((item) => item !== value);
  }
  return [...values, value];
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
