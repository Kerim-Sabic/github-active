/**
 * Generates realistic-looking file content for sandbox PRs.
 *
 * The output isn't trying to fool anyone — it's a sandbox repo, the user
 * knows. But the prior version's 6-line markdown made every PR look
 * obviously automated. This module varies file types, paths, content
 * shape, and commit messages so a casual viewer of the sandbox sees
 * what looks like a small but real engineering project.
 */

export type ContentKind = "lib" | "util" | "docs" | "test" | "config" | "fixture" | "types";

export type RealisticEntry = {
  path: string;
  content: string;
  message: string;
  prTitle: string;
  prBody: string;
};

const SCOPES = ["api", "core", "auth", "cache", "logger", "queue", "config", "metrics", "telemetry", "session"];
const VERBS_FEAT = ["add", "introduce", "wire", "expose", "support"];
const VERBS_FIX = ["fix", "harden", "guard", "tolerate", "repair"];
const VERBS_REFACTOR = ["refactor", "simplify", "extract", "rename", "split"];
const VERBS_DOCS = ["document", "describe", "clarify", "annotate", "rewrite"];
const VERBS_TEST = ["test", "cover", "verify", "exercise", "assert"];

const NOUNS = [
  "input validator",
  "fetch retry helper",
  "rate-limit handler",
  "session refresher",
  "feature flag reader",
  "metric tagger",
  "request signer",
  "queue dispatcher",
  "cron parser",
  "config loader",
  "error envelope",
  "tracing context",
  "schema guard",
  "hash adapter",
  "cookie parser",
  "json reviver",
  "id generator",
  "path normaliser"
];

const SUBJECTS = ["edge case", "regression", "race condition", "rounding error", "timezone drift", "stale handle", "retry storm"];

const PR_FOOTERS = [
  "Smoke-tested locally against the staging fixture.",
  "Diff is intentionally tiny — easier to review and roll back.",
  "Behaviour is feature-flagged off by default.",
  "Includes a regression test for the symptom in #ops.",
  "No external dependencies added.",
  "Backwards-compatible — the old call site still resolves.",
  "Verified the change is a no-op for the existing happy path."
];

export function generateRealisticEntry(input: {
  ts: number;
  index: number;
  total: number;
  kind: "pull-shark" | "yolo" | "pair-extraordinaire";
  randomSuffix: string;
  partnerLogin?: string;
}): RealisticEntry {
  const seed = mulberry32(hash(`${input.ts}-${input.index}-${input.randomSuffix}`));
  const contentKind = pickContentKind(seed);
  const scope = pick(seed, SCOPES);
  const noun = pick(seed, NOUNS);
  const subject = pick(seed, SUBJECTS);

  const conv = pickConventionalType(seed, contentKind);
  const verb = pickVerbForType(seed, conv);

  const slug = slugify(`${verb} ${noun}`);
  const date = new Date(input.ts).toISOString().slice(0, 10);

  const file = buildFile(seed, {
    kind: contentKind,
    scope,
    noun,
    subject,
    date,
    suffix: input.randomSuffix,
    partnerLogin: input.partnerLogin
  });

  const subjectLine = `${conv}(${scope}): ${verb} ${noun}`;
  const longBody = buildPrBody(seed, {
    contentKind,
    noun,
    subject,
    scope,
    runKind: input.kind,
    index: input.index,
    total: input.total,
    partnerLogin: input.partnerLogin
  });

  return {
    path: file.path.replace("__SLUG__", slug),
    content: file.content,
    message: subjectLine,
    prTitle: subjectLine,
    prBody: longBody
  };
}

type FileBlueprint = { path: string; content: string };

function buildFile(seed: () => number, ctx: {
  kind: ContentKind;
  scope: string;
  noun: string;
  subject: string;
  date: string;
  suffix: string;
  partnerLogin?: string;
}): FileBlueprint {
  switch (ctx.kind) {
    case "lib":
      return libFile(seed, ctx);
    case "util":
      return utilFile(seed, ctx);
    case "test":
      return testFile(seed, ctx);
    case "docs":
      return docsFile(seed, ctx);
    case "config":
      return configFile(seed, ctx);
    case "fixture":
      return fixtureFile(seed, ctx);
    case "types":
      return typesFile(seed, ctx);
  }
}

function libFile(seed: () => number, ctx: { scope: string; noun: string; suffix: string }): FileBlueprint {
  const fnName = camelCase(ctx.noun);
  const argName = pick(seed, ["input", "value", "payload", "request", "options"]);
  return {
    path: `src/lib/${ctx.scope}/${kebab(ctx.noun)}-${ctx.suffix}.ts`,
    content: `/**
 * ${capitalise(ctx.noun)} for the ${ctx.scope} surface.
 *
 * Pure function: no side effects, deterministic over its input.
 */

export type ${pascal(ctx.noun)}Input = {
  ${argName}: string;
  retries?: number;
};

export type ${pascal(ctx.noun)}Result =
  | { ok: true; value: string }
  | { ok: false; reason: string };

export function ${fnName}(input: ${pascal(ctx.noun)}Input): ${pascal(ctx.noun)}Result {
  const trimmed = input.${argName}.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty input" };
  }
  if (trimmed.length > 4096) {
    return { ok: false, reason: "input too large" };
  }
  return { ok: true, value: trimmed };
}
`
  };
}

function utilFile(seed: () => number, ctx: { scope: string; noun: string; suffix: string }): FileBlueprint {
  const fnName = camelCase(ctx.noun);
  return {
    path: `src/utils/${ctx.scope}/${kebab(ctx.noun)}-${ctx.suffix}.ts`,
    content: `import { performance } from "node:perf_hooks";

/**
 * Lightweight ${ctx.noun} used by the ${ctx.scope} module.
 * The input is treated as opaque; only ${pick(seed, ["length", "bytes", "checksum"])} is observed.
 */
export function ${fnName}(value: string): { tookMs: number; size: number } {
  const start = performance.now();
  let size = 0;
  for (let i = 0; i < value.length; i += 1) {
    size += value.charCodeAt(i) === 0 ? 0 : 1;
  }
  return { tookMs: performance.now() - start, size };
}

export const ${fnName}Defaults = Object.freeze({
  attempts: 3,
  backoffMs: 250
});
`
  };
}

function testFile(seed: () => number, ctx: { scope: string; noun: string; suffix: string }): FileBlueprint {
  const fnName = camelCase(ctx.noun);
  return {
    path: `src/__tests__/${ctx.scope}/${kebab(ctx.noun)}-${ctx.suffix}.test.ts`,
    content: `import { describe, expect, it } from "vitest";

describe("${fnName}", () => {
  it("returns ok for a normal input", () => {
    const result = run("${pick(seed, ["alpha", "beta", "delta", "gamma"])}");
    expect(result.ok).toBe(true);
  });

  it("rejects empty strings", () => {
    const result = run("");
    expect(result.ok).toBe(false);
  });

  it("rejects pathological input lengths", () => {
    const result = run("x".repeat(10_000));
    expect(result.ok).toBe(false);
  });
});

function run(input: string) {
  if (input.trim().length === 0) return { ok: false, reason: "empty input" } as const;
  if (input.length > 4096) return { ok: false, reason: "input too large" } as const;
  return { ok: true, value: input.trim() } as const;
}
`
  };
}

function docsFile(seed: () => number, ctx: { scope: string; noun: string; subject: string; date: string; suffix: string }): FileBlueprint {
  return {
    path: `docs/notes/${ctx.date}-${kebab(ctx.noun)}-${ctx.suffix}.md`,
    content: `# ${capitalise(ctx.noun)} — ${ctx.date}

## Context

We hit a ${ctx.subject} in the \`${ctx.scope}\` path during peak hours. Reproduces with about ${pick(seed, ["1 in 50", "1 in 200", "1 in 1000"])} requests when the upstream is degraded.

## Decision

- Treat the failure mode as transient.
- ${pick(seed, ["Retry with jitter, max 3 attempts.", "Surface a typed error and let the caller decide.", "Cache the last successful result for 30s."])}
- ${pick(seed, ["Document the failure shape in the API contract.", "Add a metric counter so we can see this in the dashboard.", "Open an issue against the upstream library if the pattern repeats."])}

## Verification

- ${pick(seed, ["Unit test reproducing the original symptom.", "Manual run against the staging fixture.", "Replay of yesterday's incident traffic."])}
- No regression in the ${pick(seed, ["happy path", "rate-limit budget", "p99 latency"])}.

## Follow-ups

- ${pick(seed, ["Consider extracting into a shared util.", "Watch error rate for one release cycle.", "Revisit when the upstream contract stabilises."])}
`
  };
}

function configFile(seed: () => number, ctx: { scope: string; suffix: string }): FileBlueprint {
  return {
    path: `config/${ctx.scope}/${ctx.suffix}.json`,
    content: JSON.stringify(
      {
        version: pick(seed, ["1.2.0", "1.3.1", "0.9.4"]),
        feature: ctx.scope,
        timeoutMs: pick(seed, [1500, 2500, 5000]),
        retries: pick(seed, [2, 3, 4]),
        labels: pick(seed, [["edge", "internal"], ["public"], ["beta"]])
      },
      null,
      2
    ) + "\n"
  };
}

function fixtureFile(seed: () => number, ctx: { scope: string; suffix: string }): FileBlueprint {
  const rows = Array.from({ length: 6 }, (_, i) => ({
    id: `${ctx.scope}-${i + 1}`,
    name: pick(seed, ["alice", "bob", "carol", "dave", "erin", "frank", "grace"]),
    status: pick(seed, ["active", "pending", "archived"]),
    score: Math.floor(seed() * 100)
  }));
  return {
    path: `fixtures/${ctx.scope}/${ctx.suffix}.json`,
    content: JSON.stringify(rows, null, 2) + "\n"
  };
}

function typesFile(seed: () => number, ctx: { scope: string; noun: string; suffix: string }): FileBlueprint {
  return {
    path: `src/types/${ctx.scope}/${kebab(ctx.noun)}-${ctx.suffix}.ts`,
    content: `/**
 * Public types for ${ctx.noun}.
 * Imported by ${pick(seed, ["the API surface", "the dashboard", "the worker"])}.
 */

export type ${pascal(ctx.noun)} = {
  id: string;
  createdAt: string;
  status: "active" | "pending" | "archived";
};

export type ${pascal(ctx.noun)}Patch = Partial<Pick<${pascal(ctx.noun)}, "status">>;

export const isActive = (value: ${pascal(ctx.noun)}): boolean => value.status === "active";
`
  };
}

function pickContentKind(seed: () => number): ContentKind {
  const n = seed();
  if (n < 0.22) return "lib";
  if (n < 0.40) return "util";
  if (n < 0.58) return "docs";
  if (n < 0.76) return "test";
  if (n < 0.85) return "types";
  if (n < 0.92) return "fixture";
  return "config";
}

function pickConventionalType(seed: () => number, kind: ContentKind): string {
  if (kind === "test") return "test";
  if (kind === "docs") return "docs";
  if (kind === "config" || kind === "fixture") return pick(seed, ["chore", "build"]);
  if (kind === "types") return pick(seed, ["feat", "refactor"]);
  return pick(seed, ["feat", "fix", "refactor", "feat", "feat"]);
}

function pickVerbForType(seed: () => number, conv: string): string {
  switch (conv) {
    case "feat": return pick(seed, VERBS_FEAT);
    case "fix": return pick(seed, VERBS_FIX);
    case "refactor": return pick(seed, VERBS_REFACTOR);
    case "docs": return pick(seed, VERBS_DOCS);
    case "test": return pick(seed, VERBS_TEST);
    default: return pick(seed, ["update", "tweak", "tidy"]);
  }
}

function buildPrBody(seed: () => number, ctx: {
  contentKind: ContentKind;
  noun: string;
  subject: string;
  scope: string;
  runKind: "pull-shark" | "yolo" | "pair-extraordinaire";
  index: number;
  total: number;
  partnerLogin?: string;
}): string {
  const summary = pick(seed, [
    `Small touch-up to the ${ctx.scope} module — covers a ${ctx.subject} I noticed during a recent review.`,
    `Adjusts the ${ctx.scope} ${ctx.noun} so the ${ctx.subject} can't slip through.`,
    `Tightens a corner of the ${ctx.scope} surface around ${ctx.noun}; behaviour for the common path is unchanged.`,
    `Walks back a sharp edge in ${ctx.scope}/${ctx.noun} that bit me last week.`
  ]);

  const before = pick(seed, [
    `- The ${ctx.noun} silently swallowed ${ctx.subject}s.`,
    `- ${capitalise(ctx.noun)} was spread across two files; one was stale.`,
    `- The current code didn't differentiate between transient and terminal failures.`,
    `- The sad path was implicit — only the happy path had a test.`
  ]);
  const after = pick(seed, [
    `- The ${ctx.noun} surfaces a typed result and the caller decides what to do.`,
    `- ${capitalise(ctx.noun)} lives in one place with a small public surface.`,
    `- Transient failures retry with jitter; terminal ones fail fast.`,
    `- Both happy and sad paths are exercised in the test below.`
  ]);

  const footer = pick(seed, PR_FOOTERS);

  const partnerLine = ctx.partnerLogin
    ? `\n\nPair-coded with @${ctx.partnerLogin} via the github-active /coop board.\n`
    : "";

  return `${summary}

### Before
${before}

### After
${after}

### Notes
${footer}${partnerLine}

> Sandbox PR ${ctx.index}/${ctx.total} from the github-active Achievement Lab. Safe to delete.
`;
}

// ---- helpers ---------------------------------------------------------------

function pick<T>(seed: () => number, list: readonly T[]): T {
  return list[Math.floor(seed() * list.length) % list.length] as T;
}

function camelCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word, i) => (i === 0 ? word.toLowerCase() : capitalise(word)))
    .join("");
}

function pascal(input: string): string {
  return input.split(/\s+/).map(capitalise).join("");
}

function kebab(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "-");
}

function capitalise(word: string): string {
  if (!word) return word;
  return word[0]!.toUpperCase() + word.slice(1).toLowerCase();
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
