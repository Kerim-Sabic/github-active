import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Github,
  GitPullRequest,
  LockKeyhole,
  Play,
  SquareTerminal,
  ServerCog,
  ShieldCheck,
  TimerReset,
  Zap
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ActivityBackdrop } from "@/shared/ui/activity-backdrop";
import { getSetupStatus } from "@/server/setup/status";

const platformSignals = [
  { label: "Scheduled dispatcher", value: "10m", icon: CalendarClock },
  { label: "Background worker", value: "15m", icon: ServerCog },
  { label: "Install token TTL", value: "1h", icon: LockKeyhole },
  { label: "Retry guard", value: "unique", icon: ShieldCheck }
];

const productPoints = [
  "GitHub App installation with selected repository access",
  "Deterministic previews before background workers write",
  "Audit trail for schedules, runs, failures, and commit links",
  "Netlify-hosted jobs that keep running after this device is off"
];

export default function HomePage() {
  const setup = getSetupStatus();

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-surface">
      <ActivityBackdrop />
      <header className="sticky top-0 z-20 border-b border-border bg-surface/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="GitHub Active home">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised">
              <Activity aria-hidden="true" className="h-5 w-5 text-accent" />
            </span>
            <span className="text-sm font-semibold text-primary">GitHub Active</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-secondary md:flex" aria-label="Primary navigation">
            <a href="#platform" className="hover:text-primary">Platform</a>
            <a href="#workflow" className="hover:text-primary">Workflow</a>
            <a href="/achievements" className="hover:text-primary">Achievement Lab</a>
            <a href="/manual" className="hover:text-primary">Manual mode</a>
            <a href="#trust" className="hover:text-primary">Trust</a>
          </nav>
          <Button asChild size="sm" variant="secondary">
            <Link href="/dashboard">Open console</Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-10 px-5 py-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="max-w-2xl">
          <StatusStrip ready={setup.canStartGitHubAuth} missing={setup.missing.length} />
          <h1 className="mt-6 text-5xl font-semibold leading-tight text-primary md:text-7xl">
            GitHub Active
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-secondary">
            A public Netlify command center for transparent developer journal automation on user-owned GitHub repositories.
            Users install a GitHub App, preview the work, and let scheduled workers run continuously.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="/connect">
                <Github aria-hidden="true" className="h-5 w-5" />
                Connect GitHub
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/dashboard">
                View console
                <ArrowRight aria-hidden="true" className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="/achievements">Achievement Lab</a>
            </Button>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-secondary sm:grid-cols-2">
            {productPoints.map((point) => (
              <div key={point} className="flex items-start gap-2 rounded-md border border-border bg-surface-raised/74 p-3 backdrop-blur">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{point}</span>
              </div>
            ))}
          </div>
          <LiveActivityStrip />
        </div>

        <ConsolePreview />
      </section>

      <section id="platform" className="relative z-10 border-y border-border bg-surface-muted/70">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-5 md:grid-cols-4">
          {platformSignals.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-border bg-surface-raised p-4">
              <div className="mb-4 flex items-center justify-between">
                <Icon aria-hidden="true" className="h-5 w-5 text-accent" />
                <span className="h-2 w-2 rounded-full bg-success" />
              </div>
              <p className="font-mono text-2xl text-primary">{value}</p>
              <p className="mt-1 text-sm text-secondary">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="relative z-10 mx-auto grid max-w-7xl gap-5 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Badge tone="accent" className="mb-4">Workflow</Badge>
          <h2 className="text-3xl font-semibold text-primary md:text-4xl">Built like an ops surface, not a toy bot.</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Install", "Users grant selected repository access through a GitHub App."],
            ["Preview", "The next file path, message, and content are visible before execution."],
            ["Run", "Netlify queues idempotent work and records the resulting commit."]
          ].map(([title, copy]) => (
            <article key={title} className="rounded-lg border border-border bg-surface-raised p-5">
              <h3 className="text-lg font-semibold text-primary">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-secondary">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-12">
        <div className="grid gap-5 rounded-lg border border-border bg-surface-raised p-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Badge tone="success" className="mb-4">Profile growth</Badge>
            <h2 className="text-2xl font-semibold text-primary">Achievement Lab without fake achievement farming.</h2>
            <p className="mt-2 text-secondary">
              Guide users toward real profile signals: clean repositories, strong docs, useful pull requests,
              visible achievements, and transparent contribution settings.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {["Profile README", "Repository hygiene", "Collaboration quality"].map((item) => (
              <div key={item} className="rounded-md border border-border bg-surface p-4">
                <CheckCircle2 aria-hidden="true" className="mb-3 h-5 w-5 text-success" />
                <p className="text-sm font-medium text-primary">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="relative z-10 mx-auto max-w-7xl px-5 pb-12">
        <div className="rounded-lg border border-border bg-surface-raised p-5 md:flex md:items-center md:justify-between">
          <div>
            <Badge tone="success" className="mb-4">Transparent automation</Badge>
            <h2 className="text-2xl font-semibold text-primary">No PATs, no hidden remotes, no deceptive backdating.</h2>
            <p className="mt-2 max-w-2xl text-secondary">
              GitHub Active writes explicit developer journal content into repositories users choose and can inspect.
            </p>
          </div>
          <Button asChild className="mt-5 md:mt-0">
            <a href="/connect">
              <Github aria-hidden="true" className="h-4 w-4" />
              Connect GitHub
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}

function StatusStrip({ ready, missing }: { ready: boolean; missing: number }) {
  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised/90 p-2 shadow-soft backdrop-blur">
      <Badge tone={ready ? "success" : "warning"}>{ready ? "Live auth ready" : `${missing} setup items`}</Badge>
      <span className="font-mono text-xs text-tertiary">githubactive.netlify.app</span>
    </div>
  );
}

function LiveActivityStrip() {
  return (
    <div className="mt-6 grid gap-2 rounded-lg border border-border bg-surface-raised/76 p-3 shadow-soft backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-tertiary">activity signal</span>
        <span className="flex items-center gap-2 text-xs text-success">
          <span className="h-2 w-2 rounded-full bg-success" />
          animated contribution field
        </span>
      </div>
      <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1">
        {Array.from({ length: 24 }, (_, index) => (
          <span
            key={index}
            className={`h-3 rounded-[3px] border border-success-muted/40 ${
              index % 7 === 0
                ? "bg-success"
                : index % 5 === 0
                  ? "bg-accent"
                  : index % 3 === 0
                    ? "bg-success-muted"
                    : "bg-surface-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ConsolePreview() {
  const days = Array.from({ length: 7 * 17 }, (_, index) => index);

  return (
    <div className="rounded-lg border border-border bg-surface-raised/94 p-3 shadow-panel backdrop-blur">
      <div className="technical-grid scanline rounded-md border border-border bg-surface-inset p-4 shadow-active">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-surface-raised">
              <SquareTerminal aria-hidden="true" className="h-5 w-5 text-accent" />
            </span>
            <div>
              <p className="text-sm font-semibold text-primary">activity-control-plane</p>
              <p className="font-mono text-xs text-tertiary">installation: selected repositories</p>
            </div>
          </div>
          <Badge tone="success">Operational</Badge>
        </div>

        <div className="grid gap-4 py-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-lg border border-border bg-surface-raised/88 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-secondary">Activity heatmap</span>
              <span className="font-mono text-xs text-success">next run 37m</span>
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-1.5">
              {days.map((day) => (
                <span
                  key={day}
                  className="aspect-square rounded-[4px] border border-border shadow-[inset_0_1px_0_oklch(100%_0_0_/_0.08)]"
                  style={{
                    background:
                      day % 19 === 0
                        ? "var(--color-success)"
                        : day % 13 === 0
                          ? "var(--color-accent)"
                          : day % 4 === 0 || day % 7 === 0
                            ? "var(--color-success-muted)"
                            : "var(--color-surface-muted)"
                  }}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {[
              { name: "scheduler-dispatcher", status: "due scan", icon: CalendarClock },
              { name: "execute-commit-background", status: "accepted", icon: Play },
              { name: "contents api", status: "write-ready", icon: GitPullRequest },
              { name: "idempotency", status: "locked", icon: ShieldCheck }
            ].map(({ name, status, icon: Icon }) => (
              <div key={name} className="flex items-center justify-between rounded-md border border-border bg-surface-raised/88 p-3">
                <div className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="h-4 w-4 text-accent" />
                  <span className="font-mono text-xs text-secondary">{name}</span>
                </div>
                <span className="text-xs text-success">{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-lg border border-border bg-surface-raised/88 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-secondary">
              <TimerReset aria-hidden="true" className="h-4 w-4 text-accent" />
              Schedule envelope
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Timezone" value="Europe/Warsaw" />
              <Metric label="Intensity" value="steady" />
              <Metric label="Catch-up" value="limited" />
              <Metric label="Tracks" value="3 active" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-raised/88 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-secondary">
              <Zap aria-hidden="true" className="h-4 w-4 text-accent" />
              Commit preview
            </div>
            <pre className="max-h-40 overflow-hidden whitespace-pre-wrap font-mono text-xs leading-6 text-secondary">{`docs/journal/2026-05-04-token-rotation.md

## Token Rotation
- Mapped GitHub App installation token boundaries.
- Added retry-safe commit idempotency keys.
- Verified author identity remains explicit.`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="font-mono text-xs text-tertiary">{label}</p>
      <p className="mt-1 text-sm font-medium text-primary">{value}</p>
    </div>
  );
}
