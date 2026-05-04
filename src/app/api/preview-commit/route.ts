import { generateCommit } from "@/server/automation/content-generator";
import { calculateNextRun } from "@/server/automation/scheduler";
import { PreviewCommitSchema } from "@/server/automation/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const raw: unknown = await request.json();
  const input = PreviewCommitSchema.parse(raw);
  const planned = calculateNextRun(input.config, new Date());
  const seed = input.seed ?? planned.idempotencyKey;
  const commit = generateCommit(input.config, planned.dueAt, seed);

  return Response.json({
    dueAt: planned.dueAt.toISOString(),
    commit
  });
}
