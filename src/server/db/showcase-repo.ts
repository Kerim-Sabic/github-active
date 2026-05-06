import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/server/db/client";
import { repoShowcase, type RepoShowcaseRow } from "@/server/db/schema";

export type ShowcaseEntry = RepoShowcaseRow;

export async function listShowcase(limit = 60): Promise<ShowcaseEntry[]> {
  const db = getDatabase();
  if (!db) return [];
  return db.select().from(repoShowcase).orderBy(desc(repoShowcase.createdAt)).limit(limit);
}

export async function listShowcaseForUser(userId: string): Promise<ShowcaseEntry[]> {
  const db = getDatabase();
  if (!db) return [];
  return db
    .select()
    .from(repoShowcase)
    .where(eq(repoShowcase.userId, userId))
    .orderBy(desc(repoShowcase.createdAt));
}

export async function addShowcaseEntry(input: {
  userId: string;
  ownerLogin: string;
  repoName: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
}): Promise<ShowcaseEntry | null> {
  const db = getDatabase();
  if (!db) return null;
  const [row] = await db
    .insert(repoShowcase)
    .values({
      userId: input.userId,
      ownerLogin: input.ownerLogin,
      repoName: input.repoName,
      description: input.description,
      homepage: input.homepage,
      language: input.language,
      stargazersCount: input.stargazersCount,
      forksCount: input.forksCount
    })
    .onConflictDoUpdate({
      target: [repoShowcase.userId, repoShowcase.ownerLogin, repoShowcase.repoName],
      set: {
        description: input.description,
        homepage: input.homepage,
        language: input.language,
        stargazersCount: input.stargazersCount,
        forksCount: input.forksCount,
        refreshedAt: sql`now()`
      }
    })
    .returning();
  return row ?? null;
}

export async function removeShowcaseEntry(input: {
  userId: string;
  ownerLogin: string;
  repoName: string;
}): Promise<void> {
  const db = getDatabase();
  if (!db) return;
  await db
    .delete(repoShowcase)
    .where(
      and(
        eq(repoShowcase.userId, input.userId),
        eq(repoShowcase.ownerLogin, input.ownerLogin),
        eq(repoShowcase.repoName, input.repoName)
      )
    );
}
