import { cookies } from "next/headers";
import {
  buildGitHubLoginUrl,
  buildGitHubStateCookie,
  createGitHubFlowState,
  pendingInstallationCookieName,
  readPendingInstallation
} from "@/server/auth/github-flow";
import { serverEnv } from "@/server/env";
import { buildConnectUrl, getSetupStatus } from "@/server/setup/status";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const setup = getSetupStatus();
  if (!setup.canStartGitHubAuth || !serverEnv.GITHUB_APP_CLIENT_ID) {
    return Response.redirect(
      buildConnectUrl({
        reason: "github_oauth_not_configured",
        from: "github-login",
        missing: setup.missing
      }),
      302
    );
  }

  const cookieStore = await cookies();
  const pending = readPendingInstallation(cookieStore.get(pendingInstallationCookieName)?.value);
  const state = createGitHubFlowState({
    kind: "login",
    installationId: pending?.installationId
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: buildGitHubLoginUrl({
        clientId: serverEnv.GITHUB_APP_CLIENT_ID,
        state
      }),
      "Set-Cookie": buildGitHubStateCookie(state)
    }
  });
}
