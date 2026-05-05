"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, ExternalLink, GitCommit, KeyRound, LockKeyhole, XCircle } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

type ManualValidation = {
  login: string;
  profileUrl: string;
  avatarUrl: string | null;
  noReplyEmail: string;
  usernameMatches: boolean | null;
  repositories: Array<{
    fullName: string;
    private: boolean;
    defaultBranch: string;
    canPush: boolean;
  }>;
};

type Status =
  | { kind: "idle" }
  | { kind: "success"; validation: ManualValidation }
  | { kind: "error"; message: string };

type CommitStatus =
  | { kind: "idle" }
  | { kind: "success"; message: string; url: string }
  | { kind: "error"; message: string };

export function ManualModeClient() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [commitStatus, setCommitStatus] = useState<CommitStatus>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function validateToken() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/manual/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, token })
        });
        const raw = (await response.json()) as { validation?: ManualValidation; error?: string };
        if (!response.ok || !raw.validation) throw new Error(raw.error ?? "Manual validation failed.");
        setStatus({ kind: "success", validation: raw.validation });
        setAuthorName(raw.validation.login);
        setAuthorEmail(raw.validation.noReplyEmail);
        const writableRepo = raw.validation.repositories.find((repo) => repo.canPush);
        setSelectedRepo(writableRepo?.fullName ?? raw.validation.repositories[0]?.fullName ?? "");
        setBranch(writableRepo?.defaultBranch ?? raw.validation.repositories[0]?.defaultBranch ?? "main");
      } catch (error) {
        setStatus({ kind: "error", message: error instanceof Error ? error.message : "Manual validation failed." });
      }
    });
  }

  function createManualCommit() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/manual/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            username,
            repoFullName: selectedRepo,
            branch,
            authorName,
            authorEmail
          })
        });
        const raw = (await response.json()) as { result?: { github: { htmlUrl: string }; commit: { message: string } }; error?: string };
        if (!response.ok || !raw.result) throw new Error(raw.error ?? "Manual commit failed.");
        setCommitStatus({
          kind: "success",
          message: raw.result.commit.message,
          url: raw.result.github.htmlUrl
        });
      } catch (error) {
        setCommitStatus({ kind: "error", message: error instanceof Error ? error.message : "Manual commit failed." });
      }
    });
  }

  return (
    <Card className="shadow-panel">
      <CardHeader
        title="Manual GitHub Access"
        eyebrow="Fallback execution path"
        action={<Badge tone="warning">No token storage</Badge>}
      />
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="GitHub username"
            placeholder="octocat"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Input
            label="Fine-grained token"
            placeholder="github_pat_..."
            type="password"
            value={token}
            helper="Sent once over HTTPS for validation. It is not saved by this app."
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={validateToken} loading={isPending} disabled={token.length < 20}>
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            Validate token
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(buildLocalEnv(username))}
          >
            <Copy aria-hidden="true" className="h-4 w-4" />
            Copy local env template
          </Button>
        </div>

        {status.kind === "error" ? (
          <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {status.message}
          </div>
        ) : null}

        {status.kind === "success" ? (
          <div className="grid gap-4">
            <div className="rounded-lg border border-success-muted bg-success-muted/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Connected as {status.validation.login}
              </div>
              {status.validation.usernameMatches === false ? (
                <p className="mt-2 text-sm text-secondary">
                  The token belongs to a different username than the one entered.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              {status.validation.repositories.map((repo) => (
                <button
                  key={repo.fullName}
                  className={`grid gap-2 rounded-md border bg-surface p-3 text-left transition-colors md:grid-cols-[1fr_auto_auto] md:items-center ${
                    selectedRepo === repo.fullName ? "border-accent" : "border-border hover:border-border-strong"
                  }`}
                  type="button"
                  onClick={() => {
                    setSelectedRepo(repo.fullName);
                    setBranch(repo.defaultBranch);
                  }}
                >
                  <div>
                    <p className="text-sm font-medium text-primary">{repo.fullName}</p>
                    <p className="font-mono text-xs text-tertiary">{repo.defaultBranch}</p>
                  </div>
                  <Badge tone={repo.private ? "warning" : "success"}>{repo.private ? "Private" : "Public"}</Badge>
                  <Badge tone={repo.canPush ? "success" : "danger"}>{repo.canPush ? "Writable" : "Read only"}</Badge>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
                <GitCommit aria-hidden="true" className="h-4 w-4 text-accent" />
                Create one transparent journal commit
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Repository" value={selectedRepo} onChange={(event) => setSelectedRepo(event.target.value)} />
                <Input label="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} />
                <Input label="Author name" value={authorName} onChange={(event) => setAuthorName(event.target.value)} />
                <Input label="Author email" value={authorEmail} onChange={(event) => setAuthorEmail(event.target.value)} />
              </div>
              <Button
                className="mt-4"
                onClick={createManualCommit}
                loading={isPending}
                disabled={!selectedRepo || !branch || !authorName || !authorEmail}
              >
                <GitCommit aria-hidden="true" className="h-4 w-4" />
                Commit journal artifact
              </Button>
              {commitStatus.kind === "success" ? (
                <a
                  className="mt-4 flex items-center gap-2 rounded-md border border-success-muted bg-success-muted p-3 text-sm text-success"
                  href={commitStatus.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  {commitStatus.message}
                </a>
              ) : null}
              {commitStatus.kind === "error" ? (
                <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                  {commitStatus.message}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-accent" />
            Manual mode limits
          </div>
          <p className="text-sm leading-6 text-secondary">
            Manual tokens are useful for local testing and one-off validation. For real 24/7 production,
            GitHub Active should use the GitHub App flow so Netlify can mint short-lived installation tokens.
          </p>
        </div>
      </div>
    </Card>
  );
}

function buildLocalEnv(username: string): string {
  return [
    "GITHUB_TOKEN=github_pat_replace_me",
    `GITHUB_USERNAME=${username || "your_username"}`,
    "REPO_PATH=./dev-activity-log",
    "REPO_REMOTE=https://github.com/OWNER/REPO.git"
  ].join("\n");
}
