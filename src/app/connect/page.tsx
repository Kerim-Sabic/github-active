import Link from "next/link";
import { AlertTriangle, ArrowRight, Database, Github, KeyRound, ServerCog, ShieldCheck } from "lucide-react";
import { ActivityBackdrop } from "@/shared/ui/activity-backdrop";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { getSetupStatus } from "@/server/setup/status";

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

      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <Badge tone={setup.canStartGitHubAuth ? "success" : "warning"} className="mb-5">
            {setup.canStartGitHubAuth ? "Automatic ready" : `${setup.missing.length} automatic setup items`}
          </Badge>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-primary md:text-6xl">
            Choose automatic GitHub App login or manual token mode.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-secondary">
            Automatic mode is best for 24/7 production. Manual mode works immediately with a fine-grained token
            and can validate access or create one transparent journal commit without storing the token.
          </p>
        </div>

        <div className="grid gap-4">
          <Card className="shadow-none">
            <CardHeader title="Automatic Mode" eyebrow="Recommended for 24/7" action={<ServerCog aria-hidden="true" className="h-5 w-5 text-accent" />} />
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-secondary">
                Uses a GitHub App, Netlify Database, scheduled dispatcher, and background worker. This is the safest production path
                because GitHub installation tokens are short-lived and repository-scoped.
              </p>
              {!setup.canStartGitHubAuth ? (
                <div className="rounded-lg border border-warning-muted bg-warning-muted/60 p-4">
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
                <Button asChild disabled={!setup.canStartGitHubAuth}>
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

          <Card className="shadow-none">
            <CardHeader title="Manual Mode" eyebrow="Works without app secrets" action={<KeyRound aria-hidden="true" className="h-5 w-5 text-accent" />} />
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-secondary">
                Paste a fine-grained GitHub token, validate access, choose a writable repository, and create one transparent journal artifact.
                The token is not saved.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <MiniStep icon={Github} title="Create token" copy="Only selected repositories." />
                <MiniStep icon={ShieldCheck} title="Grant scope" copy="Contents write, Metadata read." />
                <MiniStep icon={Database} title="No storage" copy="Token is used once." />
              </div>
              <Button asChild>
                <Link href="/manual">
                  Open manual mode
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
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
