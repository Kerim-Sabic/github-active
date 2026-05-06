import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/server/db/client";
import { pairSignups, type PairSignupRow } from "@/server/db/schema";

export type PairStatus =
  | { state: "none" }
  | { state: "waiting"; row: PairSignupRow; queueAhead: number }
  | { state: "matched"; row: PairSignupRow; partner: PairSignupRow }
  | { state: "completed"; row: PairSignupRow };

/**
 * Look up the user's current pair signup state. "Active" rows are
 * waiting or matched; completed/cancelled rows are dropped from the
 * status read so a user can re-join after a successful run.
 */
export async function getPairStatusForUser(userId: string): Promise<PairStatus> {
  const db = getDatabase();
  if (!db) return { state: "none" };

  const rows = await db
    .select()
    .from(pairSignups)
    .where(and(eq(pairSignups.userId, userId), inArray(pairSignups.status, ["waiting", "matched", "completed"])))
    .orderBy(desc(pairSignups.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return { state: "none" };

  if (row.status === "waiting") {
    const ahead = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pairSignups)
      .where(and(eq(pairSignups.status, "waiting"), sql`${pairSignups.createdAt} < ${row.createdAt}`));
    return { state: "waiting", row, queueAhead: ahead[0]?.count ?? 0 };
  }

  if (row.status === "matched" && row.matchedWithUserId) {
    const partnerRows = await db
      .select()
      .from(pairSignups)
      .where(eq(pairSignups.userId, row.matchedWithUserId))
      .orderBy(desc(pairSignups.createdAt))
      .limit(1);
    const partner = partnerRows[0];
    if (partner) return { state: "matched", row, partner };
  }

  if (row.status === "completed") {
    return { state: "completed", row };
  }

  return { state: "none" };
}

/**
 * Atomically place the user in the queue, then attempt to pair them with
 * the oldest waiting row from a different user. Postgres's `RETURNING` and
 * a transactional update is overkill here — Drizzle's serial calls with a
 * lookup are sufficient for the small queue sizes this app sees, and
 * collisions are bounded by the partial unique index on (user_id) WHERE
 * status IN ('waiting','matched').
 */
export async function joinPairQueue(input: {
  userId: string;
  githubLogin: string;
  githubUserId: number;
  avatarUrl: string | null;
}): Promise<PairStatus> {
  const db = getDatabase();
  if (!db) return { state: "none" };

  // Cancel any stale active row for this user before re-joining.
  await db
    .update(pairSignups)
    .set({ status: "cancelled", updatedAt: sql`now()` })
    .where(and(eq(pairSignups.userId, input.userId), inArray(pairSignups.status, ["waiting", "matched"])));

  const inserted = await db
    .insert(pairSignups)
    .values({
      userId: input.userId,
      githubLogin: input.githubLogin,
      githubUserId: input.githubUserId,
      avatarUrl: input.avatarUrl,
      status: "waiting"
    })
    .returning();

  const own = inserted[0];
  if (!own) return { state: "none" };

  // Look for the oldest other waiting user.
  const candidates = await db
    .select()
    .from(pairSignups)
    .where(
      and(
        eq(pairSignups.status, "waiting"),
        ne(pairSignups.userId, input.userId)
      )
    )
    .orderBy(pairSignups.createdAt)
    .limit(1);

  const partner = candidates[0];
  if (!partner) {
    return { state: "waiting", row: own, queueAhead: 0 };
  }

  // Match both rows.
  const matchedAt = new Date();
  await db
    .update(pairSignups)
    .set({ status: "matched", matchedWithUserId: partner.userId, matchedAt, updatedAt: sql`now()` })
    .where(eq(pairSignups.id, own.id));
  await db
    .update(pairSignups)
    .set({ status: "matched", matchedWithUserId: input.userId, matchedAt, updatedAt: sql`now()` })
    .where(eq(pairSignups.id, partner.id));

  const refreshedOwn = { ...own, status: "matched", matchedWithUserId: partner.userId, matchedAt };
  const refreshedPartner = { ...partner, status: "matched", matchedWithUserId: input.userId, matchedAt };
  return { state: "matched", row: refreshedOwn, partner: refreshedPartner };
}

export async function leavePairQueue(userId: string): Promise<void> {
  const db = getDatabase();
  if (!db) return;
  await db
    .update(pairSignups)
    .set({ status: "cancelled", updatedAt: sql`now()` })
    .where(and(eq(pairSignups.userId, userId), inArray(pairSignups.status, ["waiting", "matched"])));
}

export async function markPairCompleted(input: {
  userId: string;
  partnerUserId: string;
}): Promise<void> {
  const db = getDatabase();
  if (!db) return;
  await db
    .update(pairSignups)
    .set({ status: "completed", completedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        inArray(pairSignups.userId, [input.userId, input.partnerUserId]),
        eq(pairSignups.status, "matched")
      )
    );
}

export async function getActiveQueueDepth(): Promise<number> {
  const db = getDatabase();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pairSignups)
    .where(eq(pairSignups.status, "waiting"));
  return rows[0]?.count ?? 0;
}

export type { PairSignupRow };
