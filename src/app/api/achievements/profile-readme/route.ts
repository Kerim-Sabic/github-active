import { createProfileReadme } from "@/server/github/profile-readme";

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
      { error: error instanceof Error ? error.message : "Profile README update failed." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
