import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Database,
  Github,
  KeyRound,
  LockKeyhole,
  ServerCog,
  ShieldAlert
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { getSetupStatus, type SetupCheck } from "@/server/setup/status";

type SetupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

const groupIcon = {
  app: ClipboardList,
  database: Database,
  github: Github,
  security: LockKeyhole,
  worker: ServerCog
} as const satisfies Record<SetupCheck["group"], typeof Github>;

const groupTitle = {
  app: "Application",
  database: "Database",
  github: "GitHub App",
  security: "Session Security",
  worker: "Netlify Worker"
} as const satisfies Record<SetupCheck["group"], string>;

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = searchParams ? await searchParams : {};
  const status = getSetupStatus();
  const reason = readParam(params.reason);
  const from = readParam(params.from);
  const groups = groupChecks(status.checks);

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="GitHub Active home">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised">
              <Github aria-hidden="true" className="h-5 w-5 text-accent" />
            </span>
            <span className="text-sm font-semibold text-primary">GitHub Active</span>
          </Link>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="content-start">
          <Badge tone={status.ready ? "success" : "warning"} className="mb-5">
            {status.ready ? "Production ready" : "Setup incomplete"}
          </Badge>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-primary md:text-6xl">
            Connect GitHub needs production credentials.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-secondary">
            The app is deployed, but GitHub installation cannot start until Netlify has the GitHub App,
            database, and signing secrets configured. This page replaces the blank 500 with the exact
            checklist needed for the live site.
          </p>

          {reason ? (
            <div className="mt-6 rounded-lg border border-warning-muted bg-warning-muted/60 p-4 text-sm text-primary">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert aria-hidden="true" className="h-4 w-4 text-warning" />
                {formatReason(reason)}
              </div>
              {from ? <p className="mt-2 text-secondary">Source: {from}</p> : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <a href="/api/github/install">
                <Github aria-hidden="true" className="h-4 w-4" />
                Retry GitHub connect
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href="/api/setup/status">
                View setup JSON
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <Card className="shadow-none">
          <CardHeader
            title="Deployment Readiness"
            eyebrow="Redacted status"
            action={<Badge tone={status.canStartGitHubAuth ? "success" : "warning"}>{status.missing.length} missing</Badge>}
          />
          <div className="grid gap-4">
            {groups.map(([group, checks]) => {
              const Icon = groupIcon[group];
              const complete = checks.every((check) => check.configured);
              return (
                <section key={group} className="rounded-lg border border-border bg-surface p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised">
                        <Icon aria-hidden="true" className="h-4 w-4 text-accent" />
                      </span>
                      <div>
                        <h2 className="text-sm font-semibold text-primary">{groupTitle[group]}</h2>
                        <p className="font-mono text-xs text-tertiary">{checks.length} checks</p>
                      </div>
                    </div>
                    <Badge tone={complete ? "success" : "warning"}>{complete ? "Ready" : "Missing"}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {checks.map((check) => (
                      <div key={check.key} className="grid gap-2 rounded-md border border-border bg-surface-raised p-3 md:grid-cols-[180px_1fr_auto] md:items-center">
                        <code className="font-mono text-xs text-primary">{check.key}</code>
                        <span className="text-sm text-secondary">{check.requiredFor}</span>
                        <span className="flex items-center gap-2 text-sm">
                          {check.configured ? (
                            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-success" />
                          ) : (
                            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warning" />
                          )}
                          {check.configured ? "Configured" : "Required"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-10">
        <Card className="shadow-none">
          <CardHeader title="GitHub App Settings" eyebrow="Required live configuration" action={<KeyRound aria-hidden="true" className="h-5 w-5 text-tertiary" />} />
          <div className="grid gap-3 font-mono text-sm text-secondary md:grid-cols-2">
            <div className="rounded-md border border-border bg-surface p-3">Callback URL: https://githubactive.netlify.app/api/github/callback</div>
            <div className="rounded-md border border-border bg-surface p-3">Setup URL: https://githubactive.netlify.app/api/github/callback</div>
            <div className="rounded-md border border-border bg-surface p-3">Repository permissions: Contents read/write</div>
            <div className="rounded-md border border-border bg-surface p-3">Repository permissions: Metadata read</div>
          </div>
        </Card>
      </section>
    </main>
  );
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function groupChecks(checks: SetupCheck[]): Array<[SetupCheck["group"], SetupCheck[]]> {
  const order: SetupCheck["group"][] = ["app", "database", "github", "security", "worker"];
  return order.map((group) => [group, checks.filter((check) => check.group === group)]);
}

function formatReason(reason: string): string {
  return reason
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
