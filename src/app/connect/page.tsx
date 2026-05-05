import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  GitCommit,
  Github,
  KeyRound,
  LockKeyhole,
  LogIn,
  ServerCog,
  SquareTerminal,
  Workflow,
  Zap
} from "lucide-react";
import { ActivityBackdrop } from "@/shared/ui/activity-backdrop";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { getSetupStatus } from "@/server/setup/status";

const automaticSignals = [
  ["GitHub App install", "Repository-scoped access"],
  ["Netlify scheduler", "Runs when your device is off"],
  ["Background worker", "Executes longer commit jobs"],
  ["Audit trail", "Records runs and failures"]
] as const;

const manualSignals = [
  ["Fine-grained token", "Used once over HTTPS"],
  ["Repository picker", "Only writable repos are actionable"],
  ["Journal commit", "Transparent generated artifact"],
  ["No token storage", "Token never enters the database"]
] as const;

const supabaseSignals = [
  ["Supabase session", "GitHub identity cookie"],
  ["No repo writes", "Authentication only"],
  ["Manual compatible", "Use token path for one-shot commits"],
  ["GitHub App compatible", "Install app for 24/7 automation"]
] as const;

export default function ConnectPage() {
  const setup = getSetupStatus();

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-surface">
      <ActivityBackdrop density="console" />
      <header className="relative z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="GitHub Active home">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised">
              <Github aria-hidden="true" className="h-5 w-5 text-accent" />
            </span>
            <span className="text-sm font-semibold text-primary">Connect GitHub</span>
          </Link>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard">Open console</Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="content-start">
          <Badge tone={setup.canStartGitHubAuth ? "success" : "warning"} className="mb-5">
            {setup.canStartGitHubAuth ? "Automatic ready" : `${setup.missing.length} automatic setup items`}
          </Badge>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-primary md:text-6xl">
            Connect GitHub through a clean production control plane.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-secondary">
            Automatic mode is best for 24/7 production. Manual mode works immediately with a fine-grained token
            and can validate access or create one transparent journal commit without storing the token.
          </p>
          <div className="mt-6 grid gap-3">
            <ConnectionSignal icon={Workflow} label="Auth route" value={setup.canStartGitHubAuth ? "GitHub App ready" : "Manual fallback available"} tone={setup.canStartGitHubAuth ? "success" : "warning"} />
            <ConnectionSignal icon={Database} label="Database" value={setup.databaseReady ? "Postgres linked" : "Scheduler DB missing"} tone={setup.databaseReady ? "success" : "warning"} />
            <ConnectionSignal icon={LockKeyhole} label="Secrets" value={setup.securityReady ? "Sessions signed" : "Netlify secrets required"} tone={setup.securityReady ? "success" : "warning"} />
            <ConnectionSignal icon={LogIn} label="Supabase Auth" value={setup.supabaseReady ? "GitHub OAuth available" : "Supabase env missing"} tone={setup.supabaseReady ? "success" : "warning"} />
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="border-success-muted/60 bg-surface-raised/95 shadow-panel">
            <CardHeader title="Automatic Mode" eyebrow="Recommended 24/7 path" action={<ServerCog aria-hidden="true" className="h-5 w-5 text-success" />} />
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-secondary">
                Uses a GitHub App, Netlify Database, scheduled dispatcher, and background worker. This is the safest production path
                because GitHub installation tokens are short-lived and repository-scoped.
              </p>
              <SignalGrid signals={automaticSignals} icon={CheckCircle2} />
              {!setup.canStartGitHubAuth ? (
                <div className="rounded-lg border border-warning-muted bg-warning-muted/60 p-4 shadow-active">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-warning">
                    <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                    Automatic mode is not configured on Netlify yet.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {setup.missing.map((key) => (
                      <Badge key={key} tone="warning">{key}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <a href={setup.canStartGitHubAuth ? "/api/github/install" : "/setup"}>
                    <Github aria-hidden="true" className="h-4 w-4" />
                    {setup.canStartGitHubAuth ? "Connect automatically" : "View setup"}
                  </a>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/setup">
                    Setup checklist
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>

          <Card className="shadow-panel">
            <CardHeader title="Manual Mode" eyebrow="Works without app secrets" action={<KeyRound aria-hidden="true" className="h-5 w-5 text-accent" />} />
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-secondary">
                Paste a fine-grained GitHub token, validate access, choose a writable repository, and create one transparent journal artifact.
                The token is not saved.
              </p>
              <SignalGrid signals={manualSignals} icon={GitCommit} />
              <Button asChild>
                <Link href="/manual">
                  Open manual mode
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>

          <Card className="shadow-none">
            <CardHeader title="Supabase GitHub Sign-In" eyebrow="Profile session" action={<LogIn aria-hidden="true" className="h-5 w-5 text-accent" />} />
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-secondary">
                Uses the GitHub OAuth provider configured inside Supabase. This signs users into the web app,
                but repository automation still requires Automatic Mode or Manual Mode.
              </p>
              <SignalGrid signals={supabaseSignals} icon={LogIn} />
              <Button asChild variant={setup.supabaseReady ? "primary" : "secondary"}>
                <a href={setup.supabaseReady ? "/api/supabase/github" : "/setup"}>
                  <Github aria-hidden="true" className="h-4 w-4" />
                  {setup.supabaseReady ? "Sign in with Supabase GitHub" : "Configure Supabase env"}
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-12">
        <Card className="shadow-none">
          <CardHeader title="Connection Sequence" eyebrow="Operator view" action={<SquareTerminal aria-hidden="true" className="h-5 w-5 text-tertiary" />} />
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["01", "Choose mode", "Automatic for hosted SaaS, manual for immediate fallback."],
              ["02", "Grant access", "Selected repos only, with explicit contents permission."],
              ["03", "Preview output", "Inspect path, message, and content before real writes."],
              ["04", "Run safely", "Queue idempotent jobs or one manual journal artifact."]
            ].map(([step, title, copy]) => (
              <div key={step} className="rounded-lg border border-border bg-surface p-4">
                <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised font-mono text-xs text-accent">{step}</span>
                <h2 className="mt-4 text-sm font-semibold text-primary">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-secondary">{copy}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}

function SignalGrid({ signals, icon: Icon }: { signals: readonly (readonly [string, string])[]; icon: typeof Github }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {signals.map(([title, copy]) => (
        <MiniStep key={title} icon={Icon} title={title} copy={copy} />
      ))}
    </div>
  );
}

function MiniStep({ icon: Icon, title, copy }: { icon: typeof Github; title: string; copy: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-accent" />
      <h2 className="text-sm font-semibold text-primary">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-secondary">{copy}</p>
    </div>
  );
}

function ConnectionSignal({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  tone: "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised/88 p-3 shadow-soft backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface">
          <Icon aria-hidden="true" className={tone === "success" ? "h-4 w-4 text-success" : "h-4 w-4 text-warning"} />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-xs text-tertiary">{label}</p>
          <p className="truncate text-sm font-medium text-primary">{value}</p>
        </div>
      </div>
      <span className={tone === "success" ? "h-2 w-2 rounded-full bg-success" : "h-2 w-2 rounded-full bg-warning"} />
    </div>
  );
}
