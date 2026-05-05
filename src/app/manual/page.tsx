import Link from "next/link";
import { ArrowRight, Database, GitCommit, Github, KeyRound, LockKeyhole, ShieldCheck, SquareTerminal } from "lucide-react";
import { ActivityBackdrop } from "@/shared/ui/activity-backdrop";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { ManualModeClient } from "./manual-mode-client";

export default function ManualModePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-surface">
      <ActivityBackdrop density="console" />
      <header className="relative z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="GitHub Active home">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised">
              <Github aria-hidden="true" className="h-5 w-5 text-accent" />
            </span>
            <span className="text-sm font-semibold text-primary">GitHub Active</span>
          </Link>
          <Button asChild variant="secondary" size="sm">
            <Link href="/setup">Production setup</Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="content-start">
          <Badge tone="warning" className="mb-5">Manual fallback</Badge>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-primary md:text-6xl">
            Validate a GitHub token without storing it.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-secondary">
            Use this fallback when the GitHub App production credentials are not configured yet.
            The app checks the token against GitHub once, lists recent repositories, and keeps the 24/7 path on the safer GitHub App flow.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                <KeyRound aria-hidden="true" className="h-4 w-4" />
                Create fine-grained token
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href="/achievements">
                Achievement Lab
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <div className="mt-6 grid gap-3">
            <ManualFlowRow icon={KeyRound} title="Token arrives" copy="Submitted once to a serverless route over HTTPS." />
            <ManualFlowRow icon={Database} title="Access inspected" copy="GitHub returns identity and writable repositories." />
            <ManualFlowRow icon={GitCommit} title="Artifact written" copy="One transparent developer journal commit, never hidden." />
            <ManualFlowRow icon={LockKeyhole} title="Token discarded" copy="No database insert, no session storage, no long-lived credential." />
          </div>
        </div>

        <ManualModeClient />
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-12">
        <Card className="shadow-none">
          <CardHeader title="Recommended token scope" eyebrow="Least privilege" action={<ShieldCheck aria-hidden="true" className="h-5 w-5 text-tertiary" />} />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Repository access", "Only selected repositories"],
              ["Repository permissions", "Contents: Read and write, Metadata: Read"],
              ["Expiration", "Short expiration, rotate regularly"]
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-border bg-surface p-4">
                <SquareTerminal aria-hidden="true" className="mb-4 h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-primary">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-secondary">{copy}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}

function ManualFlowRow({
  icon: Icon,
  title,
  copy
}: {
  icon: typeof KeyRound;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised/76 p-3 shadow-soft backdrop-blur">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface">
        <Icon aria-hidden="true" className="h-4 w-4 text-accent" />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-secondary">{copy}</p>
      </div>
    </div>
  );
}
