import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Database,
  Github,
  GitPullRequest,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TimerReset
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

const productSignals = [
  { label: "Netlify scheduled dispatcher", value: "10 min", icon: CalendarClock },
  { label: "Background commit worker", value: "15 min max", icon: ServerCog },
  { label: "GitHub App token lifetime", value: "1 hour", icon: LockKeyhole },
  { label: "Idempotency guard", value: "unique", icon: ShieldCheck }
];

const features = [
  "GitHub App installation with selected repository access",
  "Preview every generated journal entry before execution",
  "Seeded scheduling so planned and executed content match",
  "Audit events, job runs, retry-safe commit planning"
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3" aria-label="GitHub Active home">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised">
            <Activity aria-hidden="true" className="h-5 w-5 text-accent" />
          </span>
          <span className="text-base font-semibold text-primary">GitHub Active</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-secondary md:flex" aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#design">Design</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <Button asChild size="sm" variant="secondary">
          <Link href="/dashboard">Open demo</Link>
        </Button>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-7xl items-center gap-12 px-6 py-8 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="max-w-2xl">
          <Badge tone="accent" className="mb-5">
            Netlify-native public SaaS
          </Badge>
          <h1 className="text-[clamp(2.1rem,5vw,4.4rem)] font-semibold leading-[1.05] text-primary">
            Developer journal automation that runs after your laptop is off.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-secondary">
            GitHub Active turns this local GitHub activity bot into a transparent, multi-user web app:
            GitHub App access, scheduled Netlify workers, deterministic previews, and a dashboard built
            for trust.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/api/github/install">
                <Github aria-hidden="true" className="h-5 w-5" />
                Connect GitHub
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/dashboard">
                View product demo
                <ArrowRight aria-hidden="true" className="h-5 w-5" />
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-secondary sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <DashboardPreview />
      </section>

      <section id="platform" className="border-y border-border bg-surface-muted/60">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-8 md:grid-cols-4">
          {productSignals.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-border bg-surface-raised p-4">
              <Icon aria-hidden="true" className="mb-4 h-5 w-5 text-accent" />
              <p className="font-mono text-xl text-primary">{value}</p>
              <p className="mt-1 text-sm text-secondary">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="design" className="mx-auto grid max-w-7xl gap-6 px-6 py-16 lg:grid-cols-3">
        {[
          ["Explicit control", "Users choose repositories, verified author identity, intensity, tracks, and quiet hours."],
          ["Technical surface", "Every run has idempotency, job status, generated content, and GitHub commit links."],
          ["Clean product feel", "Dense dashboard layout, real controls, restrained color, and predictable mobile behavior."]
        ].map(([title, copy]) => (
          <article key={title} className="rounded-lg border border-border bg-surface-raised p-6">
            <h2 className="text-xl font-semibold text-primary">{title}</h2>
            <p className="mt-3 leading-7 text-secondary">{copy}</p>
          </article>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-lg border border-border bg-surface-raised p-6 md:flex md:items-center md:justify-between">
          <div>
            <Badge tone="success" className="mb-4">
              Launch-ready shape
            </Badge>
            <h2 className="text-2xl font-semibold text-primary">Start open, add paid automation limits later.</h2>
            <p className="mt-2 max-w-2xl text-secondary">
              The code now has the product seams for public onboarding, repo selection, schedules, workers,
              and audit history.
            </p>
          </div>
          <Button asChild className="mt-5 md:mt-0">
            <Link href="/dashboard">Review dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function DashboardPreview() {
  const days = Array.from({ length: 49 }, (_, index) => index);

  return (
    <div className="relative">
      <div className="rounded-lg border border-border bg-surface-raised p-4 shadow-soft">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-accent-muted">
              <GitPullRequest aria-hidden="true" className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">octocat/dev-journal</p>
              <p className="font-mono text-xs text-tertiary">next run in 37m</p>
            </div>
          </div>
          <Badge tone="success">Active</Badge>
        </div>

        <div className="grid gap-4 py-4 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-3 text-sm font-medium text-secondary">Activity plan</p>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => (
                <div
                  key={day}
                  className="h-8 rounded-md border border-border"
                  style={{
                    background:
                      day % 9 === 0
                        ? "var(--color-success-muted)"
                        : day % 5 === 0
                          ? "var(--color-accent-muted)"
                          : "var(--color-surface-muted)"
                  }}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {[
              ["scheduler-dispatcher", "due scan"],
              ["execute-commit-background", "queued"],
              ["contents API", "ready"]
            ].map(([name, status]) => (
              <div key={name} className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <Database aria-hidden="true" className="h-4 w-4 text-accent" />
                  <span className="font-mono text-xs text-secondary">{name}</span>
                </div>
                <span className="text-xs text-success">{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-secondary">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-accent" />
            Preview content
          </div>
          <pre className="overflow-hidden text-ellipsis whitespace-pre-wrap font-mono text-xs leading-6 text-secondary">{`## 2026-05-04 - Token Rotation
- Mapped retry-safe GitHub App installation tokens.
- Added one idempotency key per due commit.
- Kept author identity explicit and user-owned.`}</pre>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm text-tertiary">
        <TimerReset aria-hidden="true" className="h-4 w-4" />
        Runs from Netlify, not this device.
      </div>
    </div>
  );
}
