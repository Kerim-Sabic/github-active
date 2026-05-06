"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Github, Plus, Sparkles, Star, Trash2, X } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

type FeaturedEntry = {
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  avatarUrl: string | null;
  url: string;
  pitch: string;
};

type CommunityEntry = {
  owner: string;
  repo: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  stars: number;
  avatarUrl: string | null;
  url: string;
};

type ShowcaseList = {
  configured: boolean;
  featured: FeaturedEntry[];
  community: CommunityEntry[];
};

type MyRepo = {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  language: string | null;
};

export function ShowcaseClient({ authedLogin }: { authedLogin: string | null }) {
  const [list, setList] = useState<ShowcaseList | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/showcase/list", { cache: "no-store" });
    if (!response.ok) return;
    const raw = (await response.json()) as ShowcaseList;
    setList(raw);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="grid gap-10">
      <header className="grid gap-3 md:flex md:items-end md:justify-between">
        <div>
          <Badge tone="success" className="mb-3 inline-flex">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success" />
            Showcase
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">
            Discover what other lab users are building.
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-7 text-secondary">
            Star what you actually like. No automation, no quota — every star is one human deciding the project deserves it.
          </p>
        </div>
        {authedLogin ? (
          <Button onClick={() => setPickerOpen(true)} size="sm">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Add my repo
          </Button>
        ) : (
          <Button asChild size="sm">
            <a href="/api/supabase/github">
              <Github aria-hidden="true" className="h-3.5 w-3.5" />
              Sign in to add
            </a>
          </Button>
        )}
      </header>

      <FeaturedSection featured={list?.featured ?? []} />

      <CommunitySection
        entries={list?.community ?? []}
        authedLogin={authedLogin}
        onRemoved={refresh}
      />

      {pickerOpen && authedLogin ? (
        <RepoPicker
          onClose={() => setPickerOpen(false)}
          onAdded={() => {
            setPickerOpen(false);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function FeaturedSection({ featured }: { featured: FeaturedEntry[] }) {
  if (featured.length === 0) return null;
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-3">
        <Badge tone="accent">Featured</Badge>
        <h2 className="text-base font-semibold text-primary">By the maker</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {featured.map((entry) => (
          <Card key={`${entry.owner}/${entry.repo}`} className="grid gap-3">
            <div className="flex items-start gap-3">
              {entry.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.avatarUrl} alt="" className="h-9 w-9 rounded-md border border-border" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-tertiary">
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-primary">{entry.owner}/{entry.repo}</p>
                <p className="mt-0.5 text-[11px] text-tertiary">★ {entry.stars.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[12px] leading-6 text-secondary">{entry.description ?? entry.pitch}</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Button asChild size="sm">
                <a href={entry.url} target="_blank" rel="noreferrer">
                  <Star aria-hidden="true" className="h-3.5 w-3.5" />
                  Star on GitHub
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={entry.url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CommunitySection({
  entries,
  authedLogin,
  onRemoved
}: {
  entries: CommunityEntry[];
  authedLogin: string | null;
  onRemoved: () => void;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-3">
        <Badge tone="success">Community</Badge>
        <h2 className="text-base font-semibold text-primary">Recently added</h2>
      </div>
      {entries.length === 0 ? (
        <Card>
          <p className="text-[12px] text-secondary">No community repos yet. Sign in and add yours to be the first.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <CommunityCard
              key={`${entry.owner}/${entry.repo}`}
              entry={entry}
              ownedByMe={authedLogin?.toLowerCase() === entry.owner.toLowerCase()}
              onRemoved={onRemoved}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CommunityCard({
  entry,
  ownedByMe,
  onRemoved
}: {
  entry: CommunityEntry;
  ownedByMe: boolean;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleRemove = async () => {
    setBusy(true);
    try {
      await fetch("/api/showcase/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: entry.owner, repo: entry.repo })
      });
      onRemoved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="grid content-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-accent">
            <Github aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-primary">{entry.owner}/{entry.repo}</p>
            <p className="mt-0.5 text-[11px] text-tertiary">★ {entry.stars.toLocaleString()}{entry.language ? ` · ${entry.language}` : ""}</p>
          </div>
        </div>
        {ownedByMe ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            aria-label="Remove from showcase"
            className="grid h-7 w-7 place-items-center rounded-md text-tertiary hover:bg-surface-hover hover:text-danger"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {entry.description ? (
        <p className="text-[12px] leading-6 text-secondary">{entry.description}</p>
      ) : (
        <p className="text-[12px] text-tertiary italic">No description</p>
      )}
      <Button asChild size="sm" variant="secondary" className="self-start">
        <a href={entry.url} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          View on GitHub
        </a>
      </Button>
    </Card>
  );
}

function RepoPicker({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [repos, setRepos] = useState<MyRepo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/showcase/my-repos")
      .then(async (response) => {
        if (!response.ok) {
          setError(`load failed (${response.status})`);
          return;
        }
        const raw = (await response.json()) as { repos: MyRepo[] };
        setRepos(raw.repos);
      })
      .catch(() => setError("could not load your repos"));
  }, []);

  const add = async (repo: MyRepo) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/showcase/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: repo.owner, repo: repo.repo })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `add failed (${response.status})`);
        return;
      }
      onAdded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-bg/80 px-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface-raised/95 p-6 shadow-[0_30px_120px_-20px_oklch(72%_0.18_150_/_0.18)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-tertiary transition-colors hover:bg-surface-hover hover:text-primary"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <h2 className="text-base font-semibold text-primary">Add a repo to the showcase</h2>
        <p className="mt-1 text-[12px] text-secondary">
          Public, owner-namespace repos only. We snapshot the description and star count, refreshed lazily.
        </p>

        {error ? (
          <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div>
        ) : null}

        <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1">
          {repos === null ? (
            <p className="text-[12px] text-tertiary">Loading your repos…</p>
          ) : repos.length === 0 ? (
            <p className="text-[12px] text-tertiary">You have no public personal repos yet.</p>
          ) : (
            repos.map((repo) => (
              <button
                key={repo.fullName}
                type="button"
                disabled={busy}
                onClick={() => add(repo)}
                className="grid gap-1 rounded-md border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-primary">{repo.fullName}</span>
                  <span className="text-[11px] text-tertiary">★ {repo.stars.toLocaleString()}</span>
                </div>
                {repo.description ? (
                  <span className="text-[12px] text-secondary">{repo.description}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
