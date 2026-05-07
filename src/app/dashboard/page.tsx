import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { getSessionUserId } from "@/server/auth/session";
import { getSupabaseAuthUser } from "@/server/auth/supabase-session";
import { getDashboardData } from "@/server/db/repository";
import { getSetupStatus } from "@/server/setup/status";
import { DashboardShell } from "./dashboard-shell";
import { LabDashboard } from "./lab-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  const supabaseUser = userId ? null : await getSupabaseAuthUser();

  // GitHub-App-authed user: keep the existing schedule console.
  if (userId) {
    const data = await getDashboardData(userId);
    const setup = getSetupStatus();
    return <DashboardShell data={data} isDemo={false} setup={setup} authMode="github-app" />;
  }

  // Supabase-authed user: show the lab-progress dashboard. The schedule
  // console requires a GitHub App installation, which Supabase auth alone
  // does not give us. The lab dashboard is the actually-useful view.
  if (supabaseUser) {
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
            <nav className="hidden items-center gap-6 text-[12px] text-secondary md:flex">
              <Link href="/achievements" className="transition-colors hover:text-primary">Lab</Link>
              <Link href="/coop" className="transition-colors hover:text-primary">Pair Board</Link>
              <Link href="/showcase" className="transition-colors hover:text-primary">Showcase</Link>
              <Link href="/manual" className="transition-colors hover:text-primary">Manual</Link>
            </nav>
            <Button asChild size="sm" variant="secondary">
              <Link href="/connect">Switch account</Link>
            </Button>
          </div>
        </header>
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-12">
          <LabDashboard login={supabaseUser.login} avatarUrl={supabaseUser.avatarUrl} />
        </section>
      </main>
    );
  }

  // Not signed in: render demo data for the marketing surface.
  const data = await getDashboardData(null);
  const setup = getSetupStatus();
  return <DashboardShell data={data} isDemo={true} setup={setup} authMode="demo" />;
}
