import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  GitPullRequest,
  Github,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Star
} from "lucide-react";
import { ActivityBackdrop } from "@/shared/ui/activity-backdrop";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { AchievementLabClient } from "./achievement-lab-client";

const achievementTracks = [
  {
    title: "Profile Foundation",
    icon: Github,
    level: "Day 1",
    items: [
      "Add a profile README with current projects, constraints, and contact links.",
      "Pin repositories that show architecture, testing, and production deployment.",
      "Show achievements and contribution visibility settings intentionally."
    ]
  },
  {
    title: "Collaboration Signals",
    icon: GitPullRequest,
    level: "Week 1",
    items: [
      "Open useful pull requests with small scope and clear review notes.",
      "Write issues that include reproduction, expected behavior, and acceptance criteria.",
      "Review code with concrete risks, test gaps, and suggested fixes."
    ]
  },
  {
    title: "Project Reputation",
    icon: Star,
    level: "Ongoing",
    items: [
      "Ship a clean README, license, contribution guide, and security policy.",
      "Keep CI green and visible so visitors can trust the repository state.",
      "Document architecture and deployment decisions as first-class artifacts."
    ]
  },
  {
    title: "Community Proof",
    icon: HeartHandshake,
    level: "Long term",
    items: [
      "Help real users through issues and discussions instead of synthetic activity.",
      "Create examples that make the project easy to evaluate in five minutes.",
      "Earn badges through genuine participation, not scripted interactions."
    ]
  }
];

const roadmap = [
  ["01", "Profile polish", "Bio, avatar, pinned repos, profile README, visible achievements."],
  ["02", "Repository hygiene", "CI, docs, license, security policy, issue templates, clean examples."],
  ["03", "Contribution quality", "Small PRs, thoughtful reviews, useful issues, reproducible bug reports."],
  ["04", "Public credibility", "Transparent roadmap, release notes, demos, and working deployment."]
];

export default function AchievementsPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-surface">
      <ActivityBackdrop />
      <header className="relative z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="GitHub Active home">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised">
              <Award aria-hidden="true" className="h-5 w-5 text-accent" />
            </span>
            <span className="text-sm font-semibold text-primary">Achievement Lab</span>
          </Link>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard">Open console</Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-10 px-5 py-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Badge tone="success" className="mb-5">Legitimate profile growth</Badge>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-primary md:text-6xl">
            Build a GitHub profile that survives serious review.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-secondary">
            Achievement Lab helps users understand GitHub profile signals, badges, repository hygiene,
            and collaboration habits. The first working action creates a real profile README commit in your
            username/username repository. It does not fake stars, script spam, or claim work that did not happen.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <a href="/manual">
                Manual access
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href="https://docs.github.com/en/account-and-profile/tutorials/personalize-your-profile" target="_blank" rel="noreferrer">
                GitHub profile docs
              </a>
            </Button>
          </div>
        </div>

        <AchievementLabClient />
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-12">
        <Card className="shadow-none">
          <CardHeader title="Achievement Operating Model" eyebrow="Transparent roadmap" action={<Sparkles aria-hidden="true" className="h-5 w-5 text-tertiary" />} />
          <div className="grid gap-3 md:grid-cols-2">
            {roadmap.map(([step, title, copy]) => (
              <div key={step} className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[56px_1fr]">
                <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-surface-raised font-mono text-sm text-accent">{step}</span>
                <div>
                  <h2 className="font-semibold text-primary">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-secondary">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-4 px-5 pb-12 md:grid-cols-2">
        {achievementTracks.map(({ title, icon: Icon, level, items }) => (
          <Card key={title} className="shadow-none">
            <CardHeader title={title} eyebrow={level} action={<Icon aria-hidden="true" className="h-5 w-5 text-accent" />} />
            <div className="grid gap-3">
              {items.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="text-sm leading-6 text-secondary">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-12">
        <Card className="shadow-none">
          <CardHeader title="Guardrails" eyebrow="No fake achievement farming" action={<ShieldCheck aria-hidden="true" className="h-5 w-5 text-tertiary" />} />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["No synthetic stars", "The app will not coordinate fake stars, follows, reactions, or badge manipulation."],
              ["No spam workflows", "The app will not script noisy issues, empty PRs, or meaningless commits for achievements."],
              ["No deceptive claims", "All generated content is labeled as transparent developer journaling."]
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-border bg-surface p-4">
                <BookOpenCheck aria-hidden="true" className="mb-4 h-5 w-5 text-accent" />
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
