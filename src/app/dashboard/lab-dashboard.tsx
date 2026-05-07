"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Github,
  GitPullRequest,
  RefreshCcw,
  Sparkles,
  Star,
  Timer,
  Users,
  Zap
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

type AchievementStatus = {
  sandboxExists: boolean;
  sandboxUrl?: string;
  mergedPullRequests: number;
  mergedPullRequestsWithoutReview: number;
  closedIssuesUnder5min: number;
  coAuthoredCommits: number;
  tiers: {
    pullShark: { reached: number | null; next: number | null; all: number[] };
    yolo: boolean;
    quickdraw: boolean;
    pair: boolean;
  };
};

type CoopStatus = {
  configured: boolean;
  state?: "none" | "waiting" | "matched" | "completed";
  queueDepth?: number;
  partner?: { login: string; avatarUrl: string | null } | null;
};

type SupporterStatus = {
  supporter: boolean;
  prompted: boolean;
  repo?: { owner: string; name: string; url: string };
};

export function LabDashboard({ login, avatarUrl }: { login: string; avatarUrl: string | null }) {
  const [achievement, setAchievement] = useState<AchievementStatus | null>(null);
  const [coop, setCoop] = useState<CoopStatus | null>(null);
  const [supporter, setSupporter] = useState<SupporterStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, s] = await Promise.all([
        fetch("/api/achievements/status", { cache: "no-store" }).then(safeJson<AchievementStatus>),
        fetch("/api/coop/status", { cache: "no-store" }).then(safeJson<CoopStatus>),
        fetch("/api/supporter/status", { cache: "no-store" }).then(safeJson<SupporterStatus>)
      ]);
      if (a) setAchievement(a);
      if (c) setCoop(c);
      if (s) setSupporter(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const achievementsEarned = countEarned(achievement);
  const profileUrl = `https://github.com/${login}?tab=achievements`;

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full border border-border" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-raised text-tertiary">
              <Github aria-hidden="true" className="h-4 w-4" />
            </span>
          )}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-tertiary">Signed in</p>
            <p className="text-base font-semibold text-primary">@{login}</p>
          </div>
          {supporter?.supporter ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-success-muted bg-success-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em] text-success">
              <Star aria-hidden="true" className="h-2.5 w-2.5" />
              Supporter
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refresh} loading={loading} size="sm" variant="secondary">
            <RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button asChild size="sm">
            <a href={profileUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              View profile
            </a>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryStat
          icon={GitPullRequest}
          label="Merged PRs"
          value={achievement?.mergedPullRequests ?? "—"}
          hint={
            achievement?.tiers.pullShark.next
              ? `${achievement.tiers.pullShark.next - (achievement.mergedPullRequests ?? 0)} to next tier`
              : "all tiers reached"
          }
        />
        <SummaryStat
          icon={Sparkles}
          label="Achievements earned"
          value={achievement ? `${achievementsEarned}/4` : "—"}
          hint="Auto-earnable in lab"
          ok={achievementsEarned > 0}
        />
        <SummaryStat
          icon={Users}
          label="Pair queue"
          value={coop?.configured === false ? "off" : (coop?.queueDepth ?? 0)}
          hint={coop?.state === "matched" ? `matched with @${coop.partner?.login}` : "ready to join"}
          ok={coop?.state === "matched"}
        />
        <SummaryStat
          icon={Star}
          label="Supporter"
          value={supporter?.supporter ? "yes" : "—"}
          hint={supporter?.repo ? `${supporter.repo.owner}/${supporter.repo.name}` : ""}
          ok={supporter?.supporter ?? false}
        />
      </div>

      {!achievement?.tiers.yolo || !achievement?.tiers.quickdraw || !achievement?.tiers.pair || !achievement?.tiers.pullShark.reached ? (
        <VisibilityCallout profileUrl={profileUrl} />
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-base font-semibold text-primary">Achievement progress</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <ProgressCard
            icon={GitPullRequest}
            title="Pull Shark"
            earned={achievement?.tiers.pullShark.reached !== null && achievement?.tiers.pullShark.reached !== undefined}
            description={
              achievement
                ? `${achievement.mergedPullRequests} merged · next tier ${achievement.tiers.pullShark.next ?? "—"}`
                : "loading"
            }
            cta={{ href: "/achievements", label: "Run more" }}
          />
          <ProgressCard
            icon={Zap}
            title="YOLO"
            earned={achievement?.tiers.yolo ?? false}
            description={achievement?.tiers.yolo ? "earned" : "merge a PR with no reviewers"}
            cta={{ href: "/achievements", label: "Run YOLO" }}
          />
          <ProgressCard
            icon={Timer}
            title="Quickdraw"
            earned={achievement?.tiers.quickdraw ?? false}
            description={achievement?.tiers.quickdraw ? "earned" : "open + close issue under 5 min"}
            cta={{ href: "/achievements", label: "Run Quickdraw" }}
          />
          <ProgressCard
            icon={Users}
            title="Pair Extraordinaire"
            earned={achievement?.tiers.pair ?? false}
            description={
              achievement?.tiers.pair
                ? "earned"
                : coop?.configured
                  ? "find a partner on the Pair Board"
                  : "co-author with another GitHub user"
            }
            cta={{ href: coop?.configured ? "/coop" : "/achievements", label: coop?.configured ? "Open Pair Board" : "Open lab" }}
          />
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-base font-semibold text-primary">Quick actions</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <QuickLink
            href="/achievements"
            title="Achievement Lab"
            body="One-click runners for Pull Shark, YOLO, Quickdraw, and Pair Extraordinaire."
          />
          <QuickLink
            href="/contribute"
            title="Contribute Wizard"
            body="AI-drafted PRs to real OSS projects in your languages — earn real Pull Shark."
          />
          <QuickLink
            href="/hunt"
            title="Galaxy Brain Hunter"
            body="Find low-answer Discussions, AI-draft a real answer to post."
          />
          <QuickLink
            href="/coop"
            title="Pair Board"
            body="Match with another user and run a mutual co-authored commit."
          />
          <QuickLink
            href="/showcase"
            title="Showcase"
            body="Discover other lab users' projects. Star what you actually like."
          />
          <QuickLink
            href="/settings"
            title="Settings"
            body="Paste your OpenAI key for unlimited AI drafts."
          />
        </div>
      </section>

      {achievement?.sandboxUrl ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-accent">
              <Github aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-tertiary">Sandbox repo</p>
              <p className="font-mono text-[13px] text-primary">{login}/github-active-sandbox</p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary">
            <a href={achievement.sandboxUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              Open sandbox
            </a>
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function VisibilityCallout({ profileUrl }: { profileUrl: string }) {
  return (
    <Card className="flex flex-col gap-3 border-warning-muted/60 bg-warning-muted/20 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-warning-muted bg-warning-muted/30 text-warning">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-primary">Don&apos;t see the badges on your profile?</p>
          <p className="mt-1 text-[12px] leading-6 text-secondary">
            GitHub awards achievements within ~15 minutes, but they only show up if{" "}
            <span className="font-medium text-primary">Display achievements on profile</span> is enabled in your
            profile settings. Many users never realise this is off by default.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 md:flex-row">
        <Button asChild size="sm" variant="secondary">
          <a href="https://github.com/settings/profile" target="_blank" rel="noreferrer">
            Open settings
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button asChild size="sm">
          <a href={profileUrl} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            Check profile
          </a>
        </Button>
      </div>
    </Card>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  hint,
  ok
}: {
  icon: typeof GitPullRequest;
  label: string;
  value: number | string;
  hint?: string;
  ok?: boolean;
}) {
  return (
    <Card className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-tertiary">{label}</p>
        <Icon aria-hidden="true" className={`h-4 w-4 ${ok ? "text-success" : "text-accent"}`} />
      </div>
      <p className={`font-mono text-2xl ${ok ? "text-success" : "text-primary"}`}>{value}</p>
      {hint ? <p className="text-[11px] text-tertiary">{hint}</p> : null}
    </Card>
  );
}

function ProgressCard({
  icon: Icon,
  title,
  earned,
  description,
  cta
}: {
  icon: typeof GitPullRequest;
  title: string;
  earned: boolean;
  description: string;
  cta: { href: string; label: string };
}) {
  return (
    <Card className="grid content-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border ${earned ? "border-success-muted bg-success-muted/40 text-success" : "border-border bg-surface text-accent"}`}>
            {earned ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <Icon aria-hidden="true" className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-[13px] font-semibold text-primary">{title}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-tertiary">{description}</p>
          </div>
        </div>
        <Badge tone={earned ? "success" : "accent"}>{earned ? "Earned" : "Pending"}</Badge>
      </div>
      <Button asChild size="sm" variant="secondary" className="self-start">
        <Link href={cta.href as never}>
          {cta.label}
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </Card>
  );
}

function QuickLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href as never} className="group rounded-lg border border-border bg-surface-raised/70 p-5 backdrop-blur-[2px] transition-colors hover:border-border-strong">
      <p className="text-[13px] font-semibold text-primary group-hover:text-accent">{title}</p>
      <p className="mt-2 text-[12px] leading-6 text-secondary">{body}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-tertiary group-hover:text-secondary">
        Open <ArrowRight aria-hidden="true" className="h-3 w-3" />
      </span>
    </Link>
  );
}

function countEarned(status: AchievementStatus | null): number {
  if (!status) return 0;
  let n = 0;
  if (status.tiers.pullShark.reached !== null && status.tiers.pullShark.reached !== undefined) n += 1;
  if (status.tiers.yolo) n += 1;
  if (status.tiers.quickdraw) n += 1;
  if (status.tiers.pair) n += 1;
  return n;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
