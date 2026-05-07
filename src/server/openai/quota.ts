import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/server/db/client";
import { aiUsage } from "@/server/db/schema";
import { serverEnv } from "@/server/env";
import { type ResolvedKey } from "@/server/openai/key-resolver";

export const DEFAULT_MAINTAINER_DAILY_QUOTA = 10;

export function maintainerDailyQuota(): number {
  return serverEnv.OPENAI_MAINTAINER_DAILY_QUOTA ?? DEFAULT_MAINTAINER_DAILY_QUOTA;
}

export function todayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

export type QuotaStatus = {
  allowed: boolean;
  used: number;
  limit: number;
  unlimited: boolean;
};

/**
 * Pre-flight check. BYOK users are unlimited (it's their key, their bill).
 * Maintainer-key users are capped at MAINTAINER_DAILY_QUOTA per UTC day.
 */
export async function checkQuota(input: {
  userId: string | null;
  resolved: ResolvedKey;
  feature: string;
}): Promise<QuotaStatus> {
  if (input.resolved.kind === "byok") {
    return { allowed: true, used: 0, limit: -1, unlimited: true };
  }
  if (input.resolved.kind === "missing") {
    return { allowed: false, used: 0, limit: 0, unlimited: false };
  }
  if (!input.userId) {
    // No DB user row — we can't track per-user quota, so deny to be safe.
    // The page should prompt the user to wire up the database.
    return { allowed: false, used: 0, limit: maintainerDailyQuota(), unlimited: false };
  }

  const db = getDatabase();
  if (!db) {
    return { allowed: false, used: 0, limit: maintainerDailyQuota(), unlimited: false };
  }

  const limit = maintainerDailyQuota();
  const day = todayBucket();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, input.userId),
        eq(aiUsage.bucketDay, day),
        eq(aiUsage.keySource, "maintainer")
      )
    );
  const used = rows[0]?.count ?? 0;
  return { allowed: used < limit, used, limit, unlimited: false };
}

export async function recordUsage(input: {
  userId: string | null;
  resolved: ResolvedKey;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}): Promise<void> {
  if (!input.userId || input.resolved.kind === "missing") return;
  const db = getDatabase();
  if (!db) return;
  await db.insert(aiUsage).values({
    userId: input.userId,
    feature: input.feature,
    keySource: input.resolved.kind,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    reasoningTokens: input.reasoningTokens,
    bucketDay: todayBucket()
  });
}
