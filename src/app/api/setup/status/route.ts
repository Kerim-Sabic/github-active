import { getSetupStatus } from "@/server/setup/status";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json(getSetupStatus());
}
