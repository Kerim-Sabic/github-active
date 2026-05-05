import { createProfileReadme } from "@/server/github/profile-readme";
import { formatApiError } from "@/server/http/api-errors";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const raw: unknown = await request.json();
    const result = await createProfileReadme(raw);
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
      { error: formatApiError(error, "Profile README update failed.") },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
