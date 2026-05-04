import { DateTime } from "luxon";
import {
  type AutomationConfig,
  type ContentKind,
  type GeneratedCommit,
  type Track
} from "./types";
import { createSeededRandom } from "./random";

const TRACK_TOPICS = {
  frontend: ["keyboard navigation", "render budgets", "component states", "form ergonomics"],
  backend: ["idempotent workers", "query boundaries", "API contracts", "queue retries"],
  devops: ["deploy previews", "runtime checks", "release notes", "observability probes"],
  security: ["token rotation", "least privilege", "audit trails", "input parsing"],
  ai: ["prompt evaluation", "retrieval traces", "model routing", "safety checks"],
  data: ["schema drift", "index strategy", "metric snapshots", "warehouse sync"],
  systems: ["backpressure", "state machines", "failure budgets", "cache invalidation"]
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
    journal: "Document",
    snippet: "Add",
    resource: "Collect",
    config: "Tune",
    test: "Cover",
    "project-log": "Update"
  } satisfies Record<ContentKind, string>;

  return `${prefix[kind]} ${track} notes on ${topic}`;
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
    `## ${date.toFormat("yyyy-LL-dd HH:mm")} - ${title(topic)}`,
    "",
    `Track: ${track}`,
    "",
    "### Notes",
    "",
    `- Mapped the main decisions around ${topic}.`,
    "- Captured the tradeoff between fast iteration and predictable review.",
    "- Kept the next step small enough to validate in one focused session.",
    "",
    "### Next step",
    "",
    `Review one production example of ${topic} and write down the failure mode it avoids.`,
    ""
  ].join("\n");
}

function buildSnippet({ topic, date, randomInteger }: ContentInput): string {
  const limit = randomInteger(3, 8);
  const name = topic.replace(/\s+(\w)/g, (_, letter: string) => letter.toUpperCase()).replace(/\s/g, "");

  return [
    `// Created ${date.toISO()}`,
    `export type ${title(name)}Sample = {`,
    "  readonly id: string;",
    "  readonly score: number;",
    "};",
    "",
    `export function selectStable${title(name)}Items(items: readonly ${title(name)}Sample[]): ${title(name)}Sample[] {`,
    `  return items.filter((item) => item.score >= ${limit}).sort((a, b) => b.score - a.score);`,
    "}",
    ""
  ].join("\n");
}

function buildResourceNote({ topic, date }: ContentInput): string {
  return [
    `## ${date.toFormat("yyyy-LL-dd")} - Resource review: ${title(topic)}`,
    "",
    "- Official documentation reviewed for terminology and constraints.",
    "- One implementation note recorded for future onboarding.",
    "- One operational risk added to the release checklist.",
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
      checks: {
        retryLimit: randomInteger(2, 5),
        timeoutMs: randomInteger(1500, 4500),
        auditTrail: true
      },
      rollout: {
        previewFirst: true,
        requireManualConfirmation: true
      }
    },
    null,
    2
  );
}

function buildTestSnippet({ topic, date }: ContentInput): string {
  const testName = topic.replace(/\s+/g, " ");

  return [
    `// Created ${date.toISO()}`,
    "import { describe, expect, it } from \"vitest\";",
    "",
    `describe("${testName}", () => {`,
    "  it(\"keeps a deterministic audit key\", () => {",
    "    const key = [\"schedule\", \"2026-05-04T10:00:00.000Z\"].join(\":\");",
    "    expect(key).toBe(\"schedule:2026-05-04T10:00:00.000Z\");",
    "  });",
    "});",
    ""
  ].join("\n");
}

function buildProjectLog({ track, topic, date }: ContentInput): string {
  return [
    `## ${date.toFormat("yyyy-LL-dd")} - ${title(track)} project log`,
    "",
    `Focus: ${topic}`,
    "",
    "| Signal | Status | Note |",
    "| --- | --- | --- |",
    "| Scope | stable | One narrow improvement selected. |",
    "| Risk | watched | Retry and audit paths checked. |",
    "| Follow-up | queued | Add a tiny validation case. |",
    ""
  ].join("\n");
}

function title(value: string): string {
  return value
    .split(/[-\s]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}
