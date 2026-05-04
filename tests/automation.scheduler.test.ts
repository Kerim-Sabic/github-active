import { describe, expect, it } from "vitest";
import { calculateNextRun, shouldCatchUp } from "@/server/automation/scheduler";
import { createDemoConfig } from "@/server/db/demo-data";

describe("scheduler", () => {
  it("generates deterministic next runs for the same config and date", () => {
    const config = createDemoConfig();
    const from = new Date("2026-05-04T08:00:00.000Z");

    const first = calculateNextRun(config, from);
    const second = calculateNextRun(config, from);

    expect(first.dueAt.toISOString()).toBe(second.dueAt.toISOString());
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
  });

  it("keeps due times outside quiet hours in the configured timezone", () => {
    const config = createDemoConfig();
    const run = calculateNextRun(config, new Date("2026-05-04T00:00:00.000Z"));
    const hourInWarsaw = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: config.timezone,
        hour: "2-digit",
        hour12: false
      }).format(run.dueAt)
    );

    expect(hourInWarsaw).toBeGreaterThanOrEqual(config.quietHours.end);
    expect(hourInWarsaw).toBeLessThan(config.quietHours.start);
  });

  it("limits catch-up to recent missed jobs by default", () => {
    const config = createDemoConfig();
    const now = new Date("2026-05-04T12:00:00.000Z");

    expect(shouldCatchUp(config, new Date("2026-05-04T11:15:00.000Z"), now)).toBe(true);
    expect(shouldCatchUp(config, new Date("2026-05-04T08:00:00.000Z"), now)).toBe(false);
  });
});
