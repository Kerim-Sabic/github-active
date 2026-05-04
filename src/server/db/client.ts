import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/server/env";
import * as schema from "./schema";

let pool: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;

export function getDatabase(): NodePgDatabase<typeof schema> | null {
  const url = getDatabaseUrl();
  if (!url) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 3
    });
  }

  database ??= drizzle(pool, { schema });
  return database;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}
