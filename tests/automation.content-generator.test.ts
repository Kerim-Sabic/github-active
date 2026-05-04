import { describe, expect, it } from "vitest";
import { generateCommit } from "@/server/automation/content-generator";
import { createDemoConfig } from "@/server/db/demo-data";

describe("content generator", () => {
  it("is deterministic for a stable seed", () => {
    const config = createDemoConfig();
    const dueAt = new Date("2026-05-04T10:00:00.000Z");

    const first = generateCommit(config, dueAt, "stable-seed");
    const second = generateCommit(config, dueAt, "stable-seed");

    expect(first).toEqual(second);
  });

  it("produces technical content without placeholder TODO text", () => {
    const config = createDemoConfig();
    const commit = generateCommit(config, new Date("2026-05-04T10:00:00.000Z"), "technical-seed");

    expect(commit.content).not.toMatch(/TODO|placeholder|lorem/i);
    expect(commit.message.length).toBeGreaterThan(12);
    expect(commit.path).toContain("/");
  });
});
