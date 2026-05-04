import { DateTime } from "luxon";
import {
  type AutomationConfig,
  type ContentKind,
  type GeneratedCommit,
  type Track
} from "./types";
import { createSeededRandom } from "./random";

const TRACK_TOPICS = {
  frontend: ["keyboard-first command surfaces", "render budget instrumentation", "stateful component contracts", "progressive disclosure flows"],
  backend: ["idempotent background workers", "transactional API contracts", "retry-safe queue envelopes", "typed boundary parsing"],
  devops: ["deploy health probes", "rollback-ready release notes", "runtime configuration audits", "scheduled function observability"],
  security: ["least-privilege token exchange", "signed callback state", "secret rotation runbooks", "audit-event provenance"],
  ai: ["prompt evaluation harnesses", "retrieval trace inspection", "model-routing guardrails", "structured safety checks"],
  data: ["schema drift detection", "index selectivity reviews", "metric snapshot contracts", "warehouse sync reconciliation"],
  systems: ["backpressure control loops", "explicit state machines", "failure budget accounting", "cache invalidation boundaries"]
} as const satisfies Record<Track, readonly string[]>;

const KIND_PATHS = {
  journal: "journal",
  snippet: "snippets",
  resource: "resources",
  config: "configs",
  test: "tests",
  "project-log": "project-log"
} as const satisfies Record<ContentKind, string>;

export function generateCommit(config: AutomationConfig, dueAt: Date, seed: string): GeneratedCommit {
  const random = createSeededRandom(seed);
  const track = random.pick(config.tracks);
  const kind = chooseContentKind(config, random.next());
  const topic = random.pick(TRACK_TOPICS[track]);
  const date = DateTime.fromJSDate(dueAt).setZone(config.timezone);
  const slug = topic.replace(/\s+/g, "-");
  const path = buildPath(kind, track, slug, date);
  const content = buildContent({ kind, track, topic, date, randomInteger: random.integer });

  return {
    path,
    content,
    kind,
    track,
    message: buildMessage(kind, topic, track),
    idempotencyKey: seed
  };
}

function chooseContentKind(config: AutomationConfig, roll: number): ContentKind {
  let cursor = 0;

  for (const kind of ContentKindOrder) {
    cursor += config.contentMix[kind] ?? 0;
    if (roll <= cursor) return kind;
  }

  return "journal";
}

const ContentKindOrder = ["journal", "snippet", "resource", "config", "test", "project-log"] as const;

type ContentInput = {
  kind: ContentKind;
  track: Track;
  topic: string;
  date: DateTime;
  randomInteger: (min: number, max: number) => number;
};

function buildPath(kind: ContentKind, track: Track, slug: string, date: DateTime): string {
  const day = date.toFormat("yyyy-LL-dd");
  const month = date.toFormat("yyyy-LL");
  const directory = KIND_PATHS[kind];
  const extension = kind === "snippet" || kind === "test" ? "ts" : kind === "config" ? "json" : "md";

  if (kind === "journal" || kind === "resource" || kind === "project-log") {
    return `${directory}/${track}-${month}.md`;
  }

  return `${directory}/${track}-${slug}-${day}.${extension}`;
}

function buildMessage(kind: ContentKind, topic: string, track: Track): string {
  const prefix = {
    journal: "Map",
    snippet: "Implement",
    resource: "Review",
    config: "Calibrate",
    test: "Validate",
    "project-log": "Record"
  } satisfies Record<ContentKind, string>;

  return `${prefix[kind]} ${track} ${topic} journal artifact`;
}

function buildContent(input: ContentInput): string {
  const builders = {
    journal: buildJournalEntry,
    snippet: buildSnippet,
    resource: buildResourceNote,
    config: buildConfig,
    test: buildTestSnippet,
    "project-log": buildProjectLog
  } satisfies Record<ContentKind, (input: ContentInput) => string>;

  return builders[input.kind](input);
}

function buildJournalEntry({ track, topic, date }: ContentInput): string {
  return [
    `## ${date.toFormat("yyyy-LL-dd HH:mm")} - ${headline(topic)}`,
    "",
    `Track: ${track}`,
    "Artifact type: engineering journal",
    "",
    "### Context",
    "",
    `- Reviewed how ${topic} affects correctness, operator visibility, and review speed.`,
    "- Kept the note scoped to one observable behavior so future validation stays cheap.",
    "- Recorded this as a transparent journal entry instead of implying unrelated production work.",
    "",
    "### Decision Frame",
    "",
    "- Prefer explicit state over hidden process memory.",
    "- Parse data at the boundary before it reaches scheduling or worker code.",
    "- Preserve an audit trail that links intent, generated content, and execution result.",
    "",
    "### Validation Cue",
    "",
    `- Re-run one preview for ${topic} and compare the generated path/message/content before execution.`,
    "",
    "### Next step",
    "",
    `Write one tiny check that would fail if ${topic} drifted from the documented behavior.`,
    ""
  ].join("\n");
}

function buildSnippet({ topic, date, randomInteger }: ContentInput): string {
  const limit = randomInteger(3, 8);
  const name = pascal(topic);

  return [
    `// Created ${date.toISO()}`,
    `export type ${name}Signal = {`,
    "  readonly id: string;",
    "  readonly source: \"preview\" | \"worker\" | \"audit\";",
    "  readonly score: number;",
    "};",
    "",
    `export function selectReliable${name}Signals(signals: readonly ${name}Signal[]): ${name}Signal[] {`,
    `  return signals`,
    `    .filter((signal) => signal.score >= ${limit})`,
    "    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));",
    "}",
    ""
  ].join("\n");
}

function buildResourceNote({ topic, date }: ContentInput): string {
  return [
    `## ${date.toFormat("yyyy-LL-dd")} - Resource Review: ${headline(topic)}`,
    "",
    "### Reading Target",
    "",
    "- Official documentation or source material for terminology and constraints.",
    "- One implementation note that helps future onboarding.",
    "- One operational risk that belongs in a release checklist.",
    "",
    "### Extraction Template",
    "",
    "| Field | Capture |",
    "| --- | --- |",
    `| Domain term | ${topic} |`,
    "| Constraint | What must stay true in production? |",
    "| Failure mode | What breaks first when the assumption is wrong? |",
    "| Verification | Which preview, test, or log proves it? |",
    "",
    `Search terms: "${topic}", production pattern, failure mode.`,
    ""
  ].join("\n");
}

function buildConfig({ topic, date, randomInteger }: ContentInput): string {
  return JSON.stringify(
    {
      updatedAt: date.toISO(),
      area: topic,
      mode: "transparent-engineering-journal",
      checks: {
        retryLimit: randomInteger(2, 5),
        timeoutMs: randomInteger(1500, 4500),
        auditTrail: true,
        previewRequired: true
      },
      rollout: {
        previewFirst: true,
        requireManualConfirmation: true,
        rollbackNoteRequired: true
      },
      observability: {
        recordIdempotencyKey: true,
        persistWorkerOutcome: true
      }
    },
    null,
    2
  );
}

function buildTestSnippet({ topic, date }: ContentInput): string {
  const testName = topic.replace(/\s+/g, " ");
  const name = pascal(topic);

  return [
    `// Created ${date.toISO()}`,
    "import { describe, expect, it } from \"vitest\";",
    "",
    `describe("${testName}", () => {`,
    "  it(\"keeps the worker idempotency key stable\", () => {",
    `    const build${name}Key = (scheduleId: string, dueAt: string) => [scheduleId, dueAt].join(":");`,
    `    expect(build${name}Key("schedule", "2026-05-04T10:00:00.000Z")).toBe("schedule:2026-05-04T10:00:00.000Z");`,
    "  });",
    "});",
    ""
  ].join("\n");
}

function buildProjectLog({ track, topic, date }: ContentInput): string {
  return [
    `## ${date.toFormat("yyyy-LL-dd")} - ${headline(track)} Project Log`,
    "",
    `Focus: ${topic}`,
    "",
    "| Signal | Status | Note |",
    "| --- | --- | --- |",
    "| Scope | bounded | One narrow journal artifact selected. |",
    "| Risk | explicit | Hidden state and duplicate execution are the main failure modes. |",
    "| Validation | queued | Preview content before the worker writes. |",
    "| Follow-up | small | Add one deterministic check or operational note. |",
    ""
  ].join("\n");
}

function pascal(value: string): string {
  return value
    .split(/[-\s]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function headline(value: string): string {
  return value
    .split(/[-\s]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
