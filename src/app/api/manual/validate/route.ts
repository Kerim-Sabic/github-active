import { validateManualToken } from "@/server/github/manual-token";
import { formatApiError } from "@/server/http/api-errors";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const raw: unknown = await request.json();
    const validation = await validateManualToken(raw);
    return Response.json(
      { validation },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return Response.json(
      { error: formatApiError(error, "Manual token validation failed.") },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
