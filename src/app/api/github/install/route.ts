import {
  buildGitHubInstallUrl,
  buildGitHubStateCookie,
  createGitHubFlowState
} from "@/server/auth/github-flow";
import { serverEnv } from "@/server/env";
import { buildSetupUrl, getSetupStatus } from "@/server/setup/status";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const setup = getSetupStatus();
  if (!setup.canStartGitHubAuth || !serverEnv.GITHUB_APP_SLUG) {
    return Response.redirect(
      buildSetupUrl({
        reason: "github_app_not_configured",
        from: "github-install",
        missing: setup.missing
      }),
      302
    );
  }

  const state = createGitHubFlowState({ kind: "install" });
  return new Response(null, {
    status: 302,
    headers: {
      Location: buildGitHubInstallUrl(serverEnv.GITHUB_APP_SLUG, state),
      "Set-Cookie": buildGitHubStateCookie(state)
    }
  });
}
