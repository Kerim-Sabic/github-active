import Link from "next/link";
import { ArrowRight, Github, KeyRound, ServerCog, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { getSetupStatus } from "@/server/setup/status";

export default function ConnectPage() {
  const setup = getSetupStatus();

  return (
    <main className="relative z-10 min-h-screen">
      <header className="border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5" aria-label="GitHub Active home">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface-raised">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-accent" />
            </span>
            <span className="text-[13px] font-semibold tracking-tight text-primary">GitHub Active</span>
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-3xl gap-8 px-6 py-16">
        <div className="text-center">
          <Badge tone="success" className="mx-auto mb-5 inline-flex">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success" />
            One-step sign in
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-primary md:text-5xl">
            Sign in with GitHub.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-7 text-secondary">
            Supabase handles the OAuth flow and gives the app a token with the <span className="font-mono text-primary">repo</span>{" "}
            scope so the Achievement Lab can run real PRs in your sandbox repo.
          </p>
        </div>

        <Card className="text-center">
          <div className="mx-auto grid max-w-md gap-5 px-2 py-2">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-surface text-accent">
              <Github aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-primary">Connect with GitHub</h2>
              <p className="mt-2 text-[12px] leading-6 text-secondary">
                You will see GitHub&apos;s consent screen listing the <span className="font-mono">repo</span> scope.
                That scope lets the lab create branches, open PRs, and merge them in your sandbox repo.
              </p>
            </div>
            <Button asChild size="lg">
              <a href={setup.supabaseReady ? "/api/supabase/github" : "/setup"}>
                <Github aria-hidden="true" className="h-4 w-4" />
                {setup.supabaseReady ? "Sign in with GitHub" : "Configure Supabase env"}
              </a>
            </Button>
            {!setup.supabaseReady ? (
              <p className="text-[11px] text-warning">
                Supabase is not configured yet — set <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span>, then add{" "}
                <span className="font-mono">repo</span> to the GitHub provider scopes in your Supabase dashboard.
              </p>
            ) : null}
          </div>
        </Card>

        <details className="rounded-lg border border-border bg-surface-raised/70 backdrop-blur-[2px]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[13px] text-secondary hover:text-primary">
            <span className="flex items-center gap-3">
              <ServerCog aria-hidden="true" className="h-4 w-4 text-accent" />
              <span className="font-medium text-primary">Advanced — GitHub App for scheduled commits</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </summary>
          <div className="grid gap-3 border-t border-border px-5 py-4 text-[12px] leading-6 text-secondary">
            <p>
              Scheduled commit automation uses short-lived installation tokens minted by a GitHub App. Use this if you
              want background workers that run when your laptop is off.
            </p>
            <Button asChild size="sm" variant="secondary" className="self-start">
              <a href={setup.canStartGitHubAuth ? "/api/github/install" : "/setup"}>
                {setup.canStartGitHubAuth ? "Install GitHub App" : "View setup checklist"}
              </a>
            </Button>
          </div>
        </details>

        <details className="rounded-lg border border-border bg-surface-raised/70 backdrop-blur-[2px]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[13px] text-secondary hover:text-primary">
            <span className="flex items-center gap-3">
              <KeyRound aria-hidden="true" className="h-4 w-4 text-accent" />
              <span className="font-medium text-primary">Manual — paste a fine-grained PAT once</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </summary>
          <div className="grid gap-3 border-t border-border px-5 py-4 text-[12px] leading-6 text-secondary">
            <p>
              No accounts, no DB. The token is sent over HTTPS and used once for one transparent journal commit.
            </p>
            <Button asChild size="sm" variant="secondary" className="self-start">
              <Link href="/manual">Open manual mode</Link>
            </Button>
          </div>
        </details>

        <div className="grid gap-3 rounded-lg border border-border bg-surface-raised/70 p-5 text-[12px] leading-6 text-secondary backdrop-blur-[2px] md:grid-cols-3">
          <Pillar icon={ShieldCheck} title="Sandbox isolation" body="Automation only writes to a github-active-sandbox repo." />
          <Pillar icon={KeyRound} title="No stored secrets" body="Tokens live in your Supabase session cookie, not in our DB." />
          <Pillar icon={Sparkles} title="Honest scope" body="Achievements that need real humans are flagged and not faked." />
        </div>
      </section>
    </main>
  );
}

function Pillar({ icon: Icon, title, body }: { icon: typeof Github; title: string; body: string }) {
  return (
    <div>
      <Icon aria-hidden="true" className="mb-3 h-4 w-4 text-accent" />
      <p className="text-[12px] font-medium text-primary">{title}</p>
      <p className="mt-1 text-[12px] text-secondary">{body}</p>
    </div>
  );
}
