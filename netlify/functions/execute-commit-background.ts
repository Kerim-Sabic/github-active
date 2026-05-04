import { z } from "zod";
import { executePlannedCommit } from "../../src/server/automation/job-runner";
import { serverEnv } from "../../src/server/env";

const ExecuteCommitInputSchema = z.object({
  plannedCommitId: z.string().uuid()
});

export default async function handler(request: Request): Promise<Response> {
  if (serverEnv.INTERNAL_JOB_SECRET) {
    const secret = request.headers.get("X-Internal-Job-Secret");
    if (secret !== serverEnv.INTERNAL_JOB_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const raw: unknown = await request.json();
  const input = ExecuteCommitInputSchema.parse(raw);
  const result = await executePlannedCommit(input.plannedCommitId);
  return Response.json(result, { status: result.status === "completed" ? 200 : 202 });
}
