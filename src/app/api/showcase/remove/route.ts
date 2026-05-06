import { z } from "zod";
import { getProviderToken } from "@/server/auth/provider-token";
import { ensureUserFromProvider } from "@/server/db/user-repo";
import { removeShowcaseEntry } from "@/server/db/showcase-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InputSchema = z.object({
  owner: z.string().trim().min(1).max(80),
  repo: z.string().trim().min(1).max(120)
});

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !origin.endsWith(host)) {
    return Response.json({ error: "cross-origin" }, { status: 403 });
  }

  const provider = await getProviderToken();
  if (!provider) {
    return Response.json({ error: "not signed in", reason: "reauth_required" }, { status: 401 });
  }

  let body: z.infer<typeof InputSchema>;
  try {
    body = InputSchema.parse((await request.json()) as unknown);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "bad input" }, { status: 400 });
  }

  const userRow = await ensureUserFromProvider(provider);
  if (!userRow) return Response.json({ ok: true, persistent: false });

  await removeShowcaseEntry({
    userId: userRow.id,
    ownerLogin: body.owner,
    repoName: body.repo
  });

  return Response.json({ ok: true, persistent: true });
}
