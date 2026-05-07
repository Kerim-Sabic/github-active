import { z } from "zod";
import { githubHeaders } from "@/server/github/client";

const TreeSchema = z.object({
  sha: z.string(),
  truncated: z.boolean().optional(),
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      size: z.number().optional(),
      sha: z.string()
    })
  )
});

export type RepoTreeEntry = {
  path: string;
  type: string;
  size: number;
  sha: string;
};

const ContentSchema = z.object({
  content: z.string(),
  encoding: z.string()
});

const SKIP_DIR_PATTERNS = [
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^vendor\//,
  /^target\//,
  /^\.git\//,
  /^coverage\//,
  /^__snapshots__\//,
  /^\.cache\//
];

const SKIP_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot",
  ".mp4", ".mov", ".webm",
  ".zip", ".gz", ".tar", ".tgz", ".7z",
  ".pdf", ".lock"
];

const PRIORITY_FILES = [
  "README.md",
  "README",
  "CONTRIBUTING.md",
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "tsconfig.json"
];

export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  ref: string
): Promise<RepoTreeEntry[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers: githubHeaders(token) }
  );
  if (!response.ok) return [];
  const raw: unknown = await response.json();
  const parsed = TreeSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => ({
      path: entry.path,
      type: entry.type,
      size: entry.size ?? 0,
      sha: entry.sha
    }));
}

export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  ref: string,
  path: string
): Promise<{ content: string; sha: string } | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (!response.ok) return null;
  const raw: unknown = await response.json();
  const parsed = ContentSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.encoding !== "base64") return null;
  const text = Buffer.from(parsed.data.content, "base64").toString("utf8");
  // Hash absent in this schema — caller fetches it via tree; use empty.
  return { content: text, sha: "" };
}

/**
 * Picks the most relevant files in the repo to include as context for the
 * AI draft, biased by:
 *  - explicit `path/to/file.ext` mentions in the issue body / title,
 *  - top-level priority files (README, package.json, …),
 *  - filename keyword overlap with the issue title/body.
 *
 * Caps total bytes to keep the prompt under control.
 */
export function pickContextFiles(input: {
  tree: RepoTreeEntry[];
  issueText: string;
  maxFiles?: number;
  maxBytes?: number;
}): RepoTreeEntry[] {
  const maxFiles = input.maxFiles ?? 8;
  const maxBytes = input.maxBytes ?? 120_000;

  const filtered = input.tree.filter((entry) => {
    if (entry.size === 0) return false;
    if (entry.size > 80_000) return false;
    if (SKIP_DIR_PATTERNS.some((re) => re.test(entry.path))) return false;
    const dotIdx = entry.path.lastIndexOf(".");
    const ext = dotIdx === -1 ? "" : entry.path.slice(dotIdx).toLowerCase();
    if (SKIP_EXTENSIONS.includes(ext)) return false;
    return true;
  });

  const scored = filtered.map((entry) => ({
    entry,
    score: scorePath(entry.path, input.issueText)
  }));
  scored.sort((a, b) => b.score - a.score);

  const picked: RepoTreeEntry[] = [];
  let totalBytes = 0;
  for (const { entry, score } of scored) {
    if (picked.length >= maxFiles) break;
    if (totalBytes + entry.size > maxBytes) continue;
    if (score < 1) continue;
    picked.push(entry);
    totalBytes += entry.size;
  }
  return picked;
}

function scorePath(path: string, issueText: string): number {
  const lc = path.toLowerCase();
  const issue = issueText.toLowerCase();
  let score = 0;

  if (PRIORITY_FILES.some((p) => lc === p.toLowerCase() || lc.endsWith(`/${p.toLowerCase()}`))) {
    score += 5;
  }

  // Explicit mention of the path or filename in the issue.
  const fileName = path.split("/").pop() ?? "";
  if (issue.includes(path.toLowerCase())) score += 8;
  else if (fileName.length > 3 && issue.includes(fileName.toLowerCase())) score += 4;

  // Keyword overlap: extract camelCase / kebab / snake / dotted tokens from
  // the path and check how many appear in the issue text.
  const tokens = path
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[\\/_\-.]/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 4);

  for (const token of tokens) {
    if (issue.includes(token)) score += 1;
  }

  // Penalise tests + generated unless explicitly mentioned.
  if (/(test|spec|fixture|generated|migration)/i.test(path) && score < 8) {
    score -= 1;
  }

  // Favour typical source dirs slightly.
  if (/^(src|lib|app|pages|components|server|api|cmd|internal)\//.test(lc)) {
    score += 0.5;
  }

  return score;
}
