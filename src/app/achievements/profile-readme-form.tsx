"use client";

import { useState, useTransition } from "react";
import { BookOpenCheck, ExternalLink, KeyRound, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

type Status =
  | { kind: "idle" }
  | { kind: "success"; url: string; login: string }
  | { kind: "error"; message: string };

export function ProfileReadmeForm({ defaultLogin }: { defaultLogin: string | null }) {
  const [username, setUsername] = useState(defaultLogin ?? "");
  const [token, setToken] = useState("");
  const [headline, setHeadline] = useState(
    "Engineer building transparent automation, reliable systems, and polished product interfaces."
  );
  const [focus, setFocus] = useState(
    "Currently focused on developer tooling, GitHub APIs, and turning side projects into shippable products."
  );
  const [projectUrl, setProjectUrl] = useState("https://githubactive.netlify.app");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function publish() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/achievements/profile-readme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            token,
            headline,
            focus,
            projectUrl,
            goals: ["profile-readme", "repository-credibility"]
          })
        });
        const raw = (await response.json()) as { result?: { htmlUrl: string; login: string }; error?: string };
        if (!response.ok || !raw.result) throw new Error(raw.error ?? "Profile README update failed.");
        setStatus({ kind: "success", url: raw.result.htmlUrl, login: raw.result.login });
      } catch (error) {
        setStatus({
          kind: "error",
          message: error instanceof Error ? error.message : "Profile README update failed."
        });
      }
    });
  }

  const disabled = token.length < 20 || username.length === 0 || headline.length === 0 || focus.length === 0;

  return (
    <Card className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-accent">
            <BookOpenCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-primary">Profile README writer</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-tertiary">Foundation</p>
          </div>
        </div>
        <Badge tone="warning">Token, not stored</Badge>
      </div>

      <p className="text-[12px] leading-6 text-secondary">
        Writes a structured README into your <span className="font-mono text-primary">username/username</span> repo.
        Uses a fine-grained PAT scoped only to that repo. The token is sent once and never persisted.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="GitHub username"
          placeholder="octocat"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <Input
          label="Fine-grained token"
          type="password"
          placeholder="github_pat_..."
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
      </div>

      <Input
        label="Headline"
        value={headline}
        onChange={(event) => setHeadline(event.target.value)}
      />

      <label className="grid gap-1.5 text-sm text-secondary">
        <span className="text-[12px] font-medium text-primary">Current focus</span>
        <textarea
          className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-primary outline-none transition-colors placeholder:text-tertiary focus:border-accent focus:ring-0"
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
        />
      </label>

      <Input
        label="Featured project URL"
        value={projectUrl}
        onChange={(event) => setProjectUrl(event.target.value)}
      />

      <Button onClick={publish} loading={isPending} disabled={disabled} className="self-start">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        Publish README
      </Button>

      {status.kind === "success" ? (
        <a
          className="flex items-center gap-2 rounded-md border border-success-muted bg-success-muted/40 px-3 py-2 text-[12px] text-success"
          href={status.url}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          README updated for @{status.login}
        </a>
      ) : null}

      {status.kind === "error" ? (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          <XCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {status.message}
        </div>
      ) : null}

      <div className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[11.5px] leading-5 text-secondary">
        <KeyRound aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tertiary" />
        Token permissions: <span className="font-mono text-primary">Contents read/write</span> +{" "}
        <span className="font-mono text-primary">Metadata read</span>, scoped only to{" "}
        <span className="font-mono text-primary">{username || "username"}/{username || "username"}</span>.
      </div>
    </Card>
  );
}
