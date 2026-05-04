import { DateTime } from "luxon";
import { z } from "zod";
import { type AutomationConfig, AutomationConfigSchema } from "./types";
import { createSeededRandom } from "./random";

export const PlannedRunSchema = z.object({
  dueAt: z.date(),
  idempotencyKey: z.string().min(16)
});

export type PlannedRun = z.infer<typeof PlannedRunSchema>;

const intensityMultiplier = {
  quiet: 0.45,
  steady: 0.72,
  active: 1,
  sprint: 1.35
} as const satisfies Record<AutomationConfig["intensity"], number>;

export function calculateNextRun(configInput: AutomationConfig, from: Date): PlannedRun {
  const config = AutomationConfigSchema.parse(configInput);
  const start = DateTime.fromJSDate(from).setZone(config.timezone).plus({ minutes: 10 });

  for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
    const day = start.plus({ days: dayOffset }).startOf("day");
    if (!config.activeDays.includes(day.weekday % 7)) continue;

    const candidate = buildCandidateForDay(config, day, start);
    if (candidate <= start || isQuietHour(candidate, config.quietHours)) continue;

    return {
      dueAt: candidate.toUTC().toJSDate(),
      idempotencyKey: buildIdempotencyKey(config, candidate)
    };
  }

  const fallback = start.plus({ days: 1 }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  return {
    dueAt: fallback.toUTC().toJSDate(),
    idempotencyKey: buildIdempotencyKey(config, fallback)
  };
}

export function shouldCatchUp(config: AutomationConfig, dueAt: Date, now: Date): boolean {
  if (config.catchUpPolicy === "full") return true;
  if (config.catchUpPolicy === "skip") return dueAt >= now;

  const missedMinutes = DateTime.fromJSDate(now).diff(DateTime.fromJSDate(dueAt), "minutes").minutes;
  return missedMinutes <= 90;
}

function buildCandidateForDay(config: AutomationConfig, day: DateTime, from: DateTime): DateTime {
  const seed = `${config.repo.fullName}:${day.toISODate()}:${config.intensity}`;
  const random = createSeededRandom(seed);
  const dailyTarget = Math.max(1, Math.round(config.maxDailyCommits * intensityMultiplier[config.intensity]));
  const slot = random.integer(0, dailyTarget - 1);
  const activeStart = config.quietHours.end;
  const activeEnd = config.quietHours.start > activeStart ? config.quietHours.start : 22;
  const minutesWide = Math.max(60, (activeEnd - activeStart) * 60);
  const baseMinute = Math.floor((minutesWide / dailyTarget) * slot);
  const jitter = random.integer(0, Math.max(8, Math.floor(minutesWide / dailyTarget) - 1));
  const candidate = day.plus({ hours: activeStart, minutes: baseMinute + jitter });

  if (candidate <= from && day.hasSame(from, "day")) {
    return candidate.plus({ hours: random.integer(1, 3) });
  }

  return candidate;
}

function isQuietHour(date: DateTime, quietHours: AutomationConfig["quietHours"]): boolean {
  const hour = date.hour;
  if (quietHours.start === quietHours.end) return false;
  if (quietHours.start < quietHours.end) return hour >= quietHours.start && hour < quietHours.end;
  return hour >= quietHours.start || hour < quietHours.end;
}

function buildIdempotencyKey(config: AutomationConfig, dueAt: DateTime): string {
  return `${config.repo.fullName}:${config.branch}:${dueAt.toUTC().toISO()}`;
}
