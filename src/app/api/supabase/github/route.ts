import { serverEnv } from "@/server/env";
import { buildConnectUrl } from "@/server/setup/status";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const supabase = await createClient();
    const origin = new URL(request.url).origin;
    const redirectTo = `${getPublicAppUrl(origin)}/api/supabase/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
        scopes: "read:user user:email",
        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (error) throw error;
    if (!data.url) throw new Error("Supabase did not return a GitHub OAuth URL.");

    return Response.redirect(data.url, 302);
  } catch (error) {
    return Response.redirect(
      buildConnectUrl({
        reason: "supabase_github_auth_not_configured",
        from: "supabase-github",
        missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
      }),
      302
    );
  }
}

function getPublicAppUrl(origin: string): string {
  const configured = serverEnv.APP_URL.replace(/\/$/, "");
  if (configured.startsWith("http://localhost")) return origin;
  return configured;
}
