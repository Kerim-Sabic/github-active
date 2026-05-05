"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Github, KeyRound, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

type ProfileReadmeStatus =
  | { kind: "idle" }
  | { kind: "success"; url: string; login: string }
  | { kind: "error"; message: string };

export function AchievementLabClient() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [headline, setHeadline] = useState("Developer building transparent automation, reliable systems, and polished product interfaces.");
  const [focus, setFocus] = useState("Currently focused on GitHub App authentication, scheduled workers, deterministic previews, and visible engineering audit trails.");
  const [projectUrl, setProjectUrl] = useState("https://githubactive.netlify.app");
  const [status, setStatus] = useState<ProfileReadmeStatus>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function updateProfileReadme() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/achievements/profile-readme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, token, headline, focus, projectUrl })
        });
        const raw = (await response.json()) as { result?: { htmlUrl: string; login: string }; error?: string };
        if (!response.ok || !raw.result) throw new Error(raw.error ?? "Profile README update failed.");
        setStatus({ kind: "success", url: raw.result.htmlUrl, login: raw.result.login });
      } catch (error) {
        setStatus({ kind: "error", message: error instanceof Error ? error.message : "Profile README update failed." });
      }
    });
  }

  return (
    <Card className="shadow-panel">
      <CardHeader
        title="Do A Real Profile Upgrade"
        eyebrow="Achievement Lab action"
        action={<Badge tone="success">Writes README.md</Badge>}
      />
      <div className="grid gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Github aria-hidden="true" className="h-4 w-4 text-accent" />
            Before you run this
          </div>
          <p className="text-sm leading-6 text-secondary">
            Create a public repository named exactly like your GitHub username, then give the fine-grained token
            write access to that repository. GitHub renders that repository README on your profile.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="GitHub username" placeholder="octocat" value={username} onChange={(event) => setUsername(event.target.value)} />
          <Input label="Fine-grained token" placeholder="github_pat_..." type="password" value={token} onChange={(event) => setToken(event.target.value)} />
        </div>
        <Input label="Profile headline" value={headline} onChange={(event) => setHeadline(event.target.value)} />
        <label className="grid gap-2 text-sm text-secondary">
          <span className="font-medium text-primary">Current focus</span>
          <textarea
            className="min-h-28 rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-tertiary focus:border-accent focus:ring-2 focus:ring-accent-muted"
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
          />
        </label>
        <Input label="Featured project URL" value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} />
        <Button onClick={updateProfileReadme} loading={isPending} disabled={token.length < 20 || !username || !headline || !focus}>
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Update profile README
        </Button>

        {status.kind === "success" ? (
          <a
            className="flex items-center gap-2 rounded-md border border-success-muted bg-success-muted p-3 text-sm text-success"
            href={status.url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Profile README updated for {status.login}
          </a>
        ) : null}

        {status.kind === "error" ? (
          <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {status.message}
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <KeyRound aria-hidden="true" className="h-4 w-4 text-accent" />
            Token permissions
          </div>
          <p className="text-sm leading-6 text-secondary">
            Use a fine-grained token scoped only to the username/username profile repository with Contents read/write and Metadata read.
            The token is sent once and is not stored.
          </p>
        </div>
      </div>
    </Card>
  );
}
