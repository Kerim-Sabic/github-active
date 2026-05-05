import { createManualJournalCommit } from "@/server/github/manual-token";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const raw: unknown = await request.json();
    const result = await createManualJournalCommit(raw);
    return Response.json(
      { result },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Manual commit failed." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
