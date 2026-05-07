"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Sparkles, Star, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

const OPENAI_KEY_STORAGE = "github-active:openai-key";

export function SettingsClient({
  authedLogin,
  isMaintainer
}: {
  authedLogin: string | null;
  isMaintainer: boolean;
}) {
  const [key, setKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem(OPENAI_KEY_STORAGE);
    if (existing) {
      setKey(existing);
      setHasKey(true);
    }
  }, []);

  const save = () => {
    if (typeof window === "undefined") return;
    if (key.trim().length < 20) return;
    window.localStorage.setItem(OPENAI_KEY_STORAGE, key.trim());
    setHasKey(true);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 3000);
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(OPENAI_KEY_STORAGE);
    setKey("");
    setHasKey(false);
  };

  return (
    <div className="grid gap-8">
      <header>
        <Badge tone="success" className="mb-3 inline-flex">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success" />
          Settings
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">Your AI key</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-7 text-secondary">
          The Contribute Wizard and Galaxy Brain Hunter use an OpenAI reasoning model. Paste your own key to use them
          without limits — it&apos;s stored only in your browser&apos;s localStorage and sent on each request as the
          <span className="mx-1 font-mono">X-OpenAI-Key</span> header.
        </p>
      </header>

      <Card className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-accent">
              <KeyRound aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-primary">OpenAI API key</p>
              <p className="mt-0.5 text-[11px] text-tertiary">
                {hasKey ? "Saved in this browser" : "Not set"}
              </p>
            </div>
          </div>
          {hasKey ? <Badge tone="success">Active</Badge> : null}
        </div>

        <div className="grid gap-2">
          <div className="flex gap-2">
            <Input
              label=""
              placeholder="sk-..."
              type={reveal ? "text" : "password"}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              className="font-mono"
            />
            <button
              type="button"
              onClick={() => setReveal((current) => !current)}
              aria-label={reveal ? "Hide" : "Show"}
              className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-md border border-border bg-surface text-tertiary transition-colors hover:text-primary"
            >
              {reveal ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-tertiary">
            Generate at <a className="underline-offset-2 hover:underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a>.
            We recommend a project-scoped key with a usage limit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={key.trim().length < 20}>
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            {savedAt ? "Saved" : "Save key"}
          </Button>
          {hasKey ? (
            <Button onClick={clear} variant="secondary">
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="grid gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-accent">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-primary">Maintainer status</p>
            <p className="mt-0.5 text-[11px] text-tertiary">{authedLogin ? `Signed in as @${authedLogin}` : "Not signed in"}</p>
          </div>
        </div>
        {isMaintainer ? (
          <div className="rounded-md border border-success-muted bg-success-muted/30 px-3 py-2 text-[12px] text-success">
            <div className="flex items-start gap-2">
              <Star aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                You&apos;re on the maintainer allowlist. The app falls back to the server-side maintainer key
                (<span className="font-mono">OPENAI_API_KEY_MAINTAINER</span> on Netlify) when no personal key is set,
                with a default daily limit of 10 drafts.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-secondary">
            You&apos;re not on the maintainer allowlist, so AI features require your own OpenAI key. There&apos;s no usage
            limit on a personal key — costs go to your OpenAI account.
          </div>
        )}
      </Card>

      <Card className="grid gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-tertiary">
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-primary">Where the key goes</p>
            <ul className="mt-2 grid gap-1 text-[12px] leading-6 text-secondary">
              <li>• Stored in <span className="font-mono">localStorage</span> on this browser only.</li>
              <li>• Sent on each AI request as the <span className="font-mono">X-OpenAI-Key</span> header over HTTPS.</li>
              <li>• Never written to our database. Never logged.</li>
              <li>• Cleared when you click Remove or your browser clears site data.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
