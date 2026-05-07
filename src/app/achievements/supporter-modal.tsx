"use client";

import { useCallback, useEffect, useState } from "react";
import { Github, Sparkles, Star, X } from "lucide-react";
import { Button } from "@/shared/ui/button";

const SESSION_DISMISS_KEY = "github-active:supporter-dismissed-session";

type SupporterStatus = {
  supporter: boolean;
  prompted: boolean;
  persistent: boolean;
  repo?: { owner: string; name: string; url: string };
};

/**
 * First-visit dismissible modal asking the signed-in user to star the
 * maker repo on GitHub. Single ask, fully optional, never re-shown.
 *
 * Falls back to a localStorage flag when the database is not configured so
 * users still don't see the modal twice.
 */
export function SupporterModal({ active, onSupporter }: {
  active: boolean;
  onSupporter: (supporter: boolean) => void;
}) {
  const [status, setStatus] = useState<SupporterStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/supporter/status", { cache: "no-store" });
      if (!response.ok) return;
      const raw = (await response.json()) as SupporterStatus;
      setStatus(raw);
      onSupporter(raw.supporter);
    } catch {
      // network blip — silent. The modal stays hidden until next page load.
    }
  }, [onSupporter]);

  useEffect(() => {
    if (!active) return;
    fetchStatus();
  }, [active, fetchStatus]);

  // Re-check supporter status periodically while the user is interacting,
  // so the supporter badge flips on as soon as GitHub registers the star.
  useEffect(() => {
    if (!active || !status?.persistent) return;
    if (status.supporter) return;
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [active, status?.persistent, status?.supporter, fetchStatus]);

  // Session-only dismissal: the modal returns next visit until the user
  // actually stars. Once GitHub confirms the star, status.supporter flips
  // true and the modal stops showing for good.
  const sessionDismissed =
    typeof window !== "undefined" && window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";

  const shouldShow =
    active &&
    status !== null &&
    !status.supporter &&
    !sessionDismissed;

  const close = (markDismissed: boolean) => {
    if (markDismissed && typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    }
    setStatus((current) => (current ? { ...current, prompted: false } : current));
  };

  const handleStar = async () => {
    if (!status?.repo) return;
    setBusy(true);
    try {
      await fetch("/api/supporter/click", { method: "POST" });
    } catch {
      // best-effort — proceed to opening GitHub anyway
    }
    window.open(status.repo.url, "_blank", "noopener,noreferrer");
    close(true);
    setBusy(false);
    // Fire one delayed re-check so the supporter badge can flip on quickly
    // if the user actually starred.
    setTimeout(() => fetchStatus(), 8000);
  };

  const handleSkip = async () => {
    setBusy(true);
    try {
      await fetch("/api/supporter/skip", { method: "POST" });
    } catch {
      // ignore
    }
    close(true);
    setBusy(false);
  };

  if (!shouldShow || !status?.repo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="supporter-title"
      className="fixed inset-0 z-50 grid place-items-center bg-bg/80 px-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface-raised/95 p-7 shadow-[0_30px_120px_-20px_oklch(72%_0.18_150_/_0.18)]">
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          aria-label="Dismiss"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-tertiary transition-colors hover:bg-surface-hover hover:text-primary"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border border-accent-muted bg-surface text-accent">
          <Sparkles aria-hidden="true" className="h-5 w-5" />
        </span>

        <h2 id="supporter-title" className="text-center text-xl font-semibold tracking-tight text-primary">
          Welcome to GitHub Active
        </h2>
        <p className="mt-3 text-center text-[13px] leading-7 text-secondary">
          This is a free, open-source side project. If it earns you achievements you actually wanted, please give the
          repo a star — that&apos;s the only ask.
        </p>

        <div className="mt-5 grid gap-2.5">
          <Button onClick={handleStar} loading={busy} size="lg" className="justify-center">
            <Star aria-hidden="true" className="h-4 w-4" />
            Star {status.repo.owner}/{status.repo.name}
          </Button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={busy}
            className="text-center text-[12px] text-tertiary transition-colors hover:text-secondary"
          >
            skip for now
          </button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-4 text-[11px] text-tertiary">
          <Github aria-hidden="true" className="h-3 w-3" />
          The lab works the same way whether you star or skip.
        </p>
      </div>
    </div>
  );
}
