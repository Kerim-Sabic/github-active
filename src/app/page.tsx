import Link from "next/link";
import {
  ArrowRight,
  Check,
  GitMerge,
  GitPullRequest,
  Github,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Users,
  Zap
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { getSetupStatus } from "@/server/setup/status";

const heroAchievements = [
  { name: "Pull Shark", icon: GitPullRequest, kind: "auto" },
  { name: "YOLO", icon: Zap, kind: "auto" },
  { name: "Quickdraw", icon: Timer, kind: "auto" },
  { name: "Pair Extraordinaire", icon: Users, kind: "auto" }
] as const;

const features = [
  {
    title: "One-click achievement runner",
    body: "Click Pull Shark and the app actually creates branches, opens PRs, and merges them in your sandbox repo. Real commits, real merges, real GitHub achievements.",
    icon: GitMerge
  },
  {
    title: "Sandbox-isolated by default",
    body: "All automation runs against a dedicated github-active-sandbox repo on your account. Your real projects stay clean.",
    icon: ShieldCheck
  },
  {
    title: "Sign in with GitHub. That is it.",
    body: "Supabase OAuth handles auth. The repo scope token powers the lab. No PATs to paste, no GitHub App to install.",
    icon: Github
  }
] as const;

const automatableList = [
  ["Pull Shark", "1 / 2 / 16 / 128 / 1024 merged PRs"],
  ["YOLO", "Merge a PR with zero reviews"],
  ["Quickdraw", "Close an issue or PR within 5 minutes"],
  ["Pair Extraordinaire", "Co-authored commit with another GitHub user"]
] as const;

const socialList = [
  ["Galaxy Brain", "Needs accepted answers from real maintainers"],
  ["Starstruck", "Needs organic stars from real developers"],
  ["Heart On Sleeve", "Needs reactions from other users on your comments"],
  ["Public Sponsor", "Requires a real GitHub Sponsors payment"]
] as const;

export default function HomePage() {
  const setup = getSetupStatus();

  return (
    <main className="relative z-10 min-h-screen">
      <SiteHeader />

      <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-20 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="success" className="mx-auto mb-6 inline-flex">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success" />
            {setup.supabaseReady ? "Live • sign in with GitHub" : "Public beta"}
          </Badge>
          <h1 className="bg-gradient-to-b from-primary to-primary/70 bg-clip-text text-5xl font-semibold leading-[1.05] tracking-tight text-transparent md:text-7xl">
            Earn GitHub achievements
            <br />
            at the click of a button.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-7 text-secondary">
            Sign in with GitHub. Click <span className="text-primary">Pull Shark</span>. Watch real PRs ship into a
            sandbox repo on your account and unlock the badge — no PATs, no scripts, no spam.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href={setup.supabaseReady ? "/api/supabase/github" : "/connect"}>
                <Github aria-hidden="true" className="h-4 w-4" />
                Sign in with GitHub
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/achievements">
                Open Achievement Lab
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {heroAchievements.map(({ name, icon: Icon }) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised/70 px-3 py-1.5 text-[12px] text-secondary backdrop-blur-[2px]"
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5 text-accent" />
                {name}
              </span>
            ))}
          </div>
        </div>

        <DemoConsole />
      </section>

      <section id="features" className="border-t border-border bg-surface/60 backdrop-blur-[2px]">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-20 md:grid-cols-3">
          {features.map(({ title, body, icon: Icon }) => (
            <article key={title} className="rounded-lg border border-border bg-surface-raised/70 p-6 backdrop-blur-[2px]">
              <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-accent">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <h3 className="mt-5 text-base font-semibold text-primary">{title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-secondary">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="achievements" className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2">
          <div>
            <Badge tone="success" className="mb-4">Automatable</Badge>
            <h2 className="text-2xl font-semibold tracking-tight text-primary">
              Four achievements. One click each.
            </h2>
            <p className="mt-3 text-[13px] leading-7 text-secondary">
              These run inside <span className="font-mono text-primary">github-active-sandbox</span> — a dedicated repo
              the app creates on your account the first time you click Run.
            </p>
            <ul className="mt-6 grid gap-2.5">
              {automatableList.map(([name, body]) => (
                <li
                  key={name}
                  className="flex items-start gap-3 rounded-md border border-border bg-surface-raised/70 px-4 py-3 backdrop-blur-[2px]"
                >
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div>
                    <p className="text-[13px] font-medium text-primary">{name}</p>
                    <p className="mt-0.5 text-[12px] text-secondary">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Badge tone="warning" className="mb-4">Social — needs other humans</Badge>
            <h2 className="text-2xl font-semibold tracking-tight text-primary">
              The honest part: some can&apos;t be automated.
            </h2>
            <p className="mt-3 text-[13px] leading-7 text-secondary">
              The lab is upfront about achievements that depend on other people. We point you at the legitimate way to
              earn each one instead of pretending we can fake it.
            </p>
            <ul className="mt-6 grid gap-2.5">
              {socialList.map(([name, body]) => (
                <li
                  key={name}
                  className="flex items-start gap-3 rounded-md border border-border bg-surface-raised/70 px-4 py-3 backdrop-blur-[2px]"
                >
                  <Star aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" />
                  <div>
                    <p className="text-[13px] font-medium text-primary">{name}</p>
                    <p className="mt-0.5 text-[12px] text-secondary">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-border bg-surface/60 backdrop-blur-[2px]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-primary">How it works</h2>
          <p className="mt-3 max-w-2xl text-[13px] leading-7 text-secondary">
            Four steps. No background daemon, no stored credentials, no surprises.
          </p>
          <ol className="mt-10 grid gap-3 md:grid-cols-4">
            {[
              ["01", "Sign in", "Supabase GitHub OAuth with the repo scope."],
              ["02", "Pick", "Choose Pull Shark, YOLO, Quickdraw, or Pair Extraordinaire."],
              ["03", "Run", "The app creates branches, files, PRs, and merges them in your sandbox."],
              ["04", "Earned", "GitHub awards the achievement — usually within 15 minutes."]
            ].map(([step, title, body]) => (
              <li key={step} className="rounded-lg border border-border bg-surface-raised/70 p-5 backdrop-blur-[2px]">
                <span className="font-mono text-[11px] text-accent">{step}</span>
                <h3 className="mt-3 text-[13px] font-semibold text-primary">{title}</h3>
                <p className="mt-1.5 text-[12px] leading-6 text-secondary">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label="GitHub Active home">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface-raised">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-accent" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-primary">GitHub Active</span>
        </Link>
        <nav className="hidden items-center gap-6 text-[12px] text-secondary md:flex" aria-label="Primary">
          <a href="#features" className="transition-colors hover:text-primary">Features</a>
          <a href="#achievements" className="transition-colors hover:text-primary">Achievements</a>
          <Link href="/coop" className="transition-colors hover:text-primary">Pair Board</Link>
          <Link href="/showcase" className="transition-colors hover:text-primary">Showcase</Link>
          <Link href="/dashboard" className="transition-colors hover:text-primary">Dashboard</Link>
          <a
            href="https://github.com/Kerim-Sabic/github-active"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-primary"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/achievements">Lab</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/connect">
              <Github aria-hidden="true" className="h-3.5 w-3.5" />
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 text-[12px] text-tertiary md:flex-row md:items-center">
        <p>
          Built by{" "}
          <a
            className="text-secondary transition-colors hover:text-primary"
            href="https://github.com/Kerim-Sabic"
            target="_blank"
            rel="noreferrer"
          >
            Kerim-Sabic
          </a>
          {" "}— BSD-3-Clause licensed.
        </p>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/Kerim-Sabic/github-active"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-secondary"
          >
            Source
          </a>
          <Link href="/coop" className="transition-colors hover:text-secondary">Pair Board</Link>
          <Link href="/showcase" className="transition-colors hover:text-secondary">Showcase</Link>
          <Link href="/manual" className="transition-colors hover:text-secondary">Manual mode</Link>
          <Link href="/setup" className="transition-colors hover:text-secondary">Setup</Link>
          <a
            href="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/customizing-your-profile/personalizing-your-profile#displaying-badges-on-your-profile"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-secondary"
          >
            GitHub badges docs
          </a>
        </div>
      </div>
    </footer>
  );
}

function DemoConsole() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-lg border border-border bg-surface-raised/85 shadow-[0_30px_120px_-30px_oklch(72%_0.18_150_/_0.18)] backdrop-blur-[3px]">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          </div>
          <span className="font-mono text-[11px] text-tertiary">github-active.run · pull-shark</span>
          <span className="font-mono text-[11px] text-success">live</span>
        </div>
        <div className="grid gap-2 px-5 py-5 font-mono text-[12px] leading-6">
          <DemoLine ts="00:00" body="resolving sandbox repo" status="ok" />
          <DemoLine ts="00:01" body="branch bot/ps-1731-1 created from main" status="ok" />
          <DemoLine ts="00:02" body="entries/ps-1731-1.md committed" status="ok" />
          <DemoLine ts="00:03" body="pr #142 opened" status="ok" />
          <DemoLine ts="00:04" body="pr #142 merged (squash)" status="ok" />
          <DemoLine ts="00:05" body="branch bot/ps-1731-2 created from main" status="ok" />
          <DemoLine ts="00:06" body="entries/ps-1731-2.md committed" status="ok" />
          <DemoLine ts="00:07" body="pr #143 opened" status="ok" />
          <DemoLine ts="00:08" body="pr #143 merged (squash)" status="ok" />
          <DemoLine ts="00:09" body="done · 2 PRs merged · pull shark eta ~15m" status="done" />
        </div>
      </div>
    </div>
  );
}

function DemoLine({ ts, body, status }: { ts: string; body: string; status: "ok" | "done" }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-tertiary">{ts}</span>
      {status === "done" ? (
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5 self-center text-accent" />
      ) : (
        <MessagesSquare aria-hidden="true" className="h-3.5 w-3.5 self-center text-secondary" />
      )}
      <span className={status === "done" ? "text-accent" : "text-secondary"}>{body}</span>
    </div>
  );
}
