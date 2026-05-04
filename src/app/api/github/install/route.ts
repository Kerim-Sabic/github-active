import { randomBytes } from "node:crypto";
import { buildOAuthStateCookie } from "@/server/auth/session";
import { requireEnv, serverEnv } from "@/server/env";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const slug = requireEnv(serverEnv.GITHUB_APP_SLUG, "GITHUB_APP_SLUG");
  const state = randomBytes(24).toString("base64url");
  const url = new URL(`https://github.com/apps/${slug}/installations/new`);
  url.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": buildOAuthStateCookie(state)
    }
  });
}
