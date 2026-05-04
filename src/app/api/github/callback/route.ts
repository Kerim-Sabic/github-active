import { cookies } from "next/headers";
import {
  buildPendingInstallationCookie,
  clearPendingInstallationCookie,
  getGitHubCallbackUrl,
  parseInstallationId,
  pendingInstallationCookieName,
  resolveGitHubCallback
} from "@/server/auth/github-flow";
import {
  buildSessionCookie,
  clearOAuthStateCookie,
  createSessionToken,
  oauthStateCookieName
} from "@/server/auth/session";
import {
  exchangeCodeForUserToken,
  getGitHubUser,
  getInstallationToken,
  listInstallationRepositories,
  listUserInstallationRepositories
} from "@/server/github/client";
import {
  replaceInstallationRepositories,
  upsertGitHubInstallation,
  upsertGitHubUser
} from "@/server/db/repository";
import { serverEnv } from "@/server/env";
import { buildSetupUrl, getSetupStatus } from "@/server/setup/status";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const action = resolveGitHubCallback({
    error: url.searchParams.get("error"),
    code: url.searchParams.get("code"),
    installationId: parseInstallationId(url.searchParams.get("installation_id")),
    stateToken: url.searchParams.get("state"),
    stateCookie: cookieStore.get(oauthStateCookieName)?.value,
    pendingInstallationToken: cookieStore.get(pendingInstallationCookieName)?.value
  });

  if (action.action === "authorize-user") {
    const headers = new Headers({
      Location: `${serverEnv.APP_URL.replace(/\/$/, "")}/api/github/login`
    });
    headers.append("Set-Cookie", buildPendingInstallationCookie(action.installationId));
    headers.append("Set-Cookie", clearOAuthStateCookie());
    return new Response(null, { status: 302, headers });
  }

  if (action.action === "error") {
    return redirectToSetup(action.reason, action.message);
  }

  const setup = getSetupStatus();
  if (!setup.canStartGitHubAuth) {
    return redirectToSetup("github_app_not_configured", "GitHub Active is missing production configuration.", setup.missing);
  }

  try {
    const userToken = await exchangeCodeForUserToken(action.code, getGitHubCallbackUrl());
    const user = await getGitHubUser(userToken);
    const visibleRepos = await listUserInstallationRepositories(userToken, action.installationId);

    if (visibleRepos.length === 0) {
      return redirectToSetup(
        "no_repositories_available",
        "GitHub returned no repositories for this installation. Reinstall the app with repository access."
      );
    }

    const userId = await upsertGitHubUser({
      githubUserId: user.id,
      login: user.login,
      avatarUrl: user.avatar_url,
      name: user.name ?? null,
      email: user.email ?? null
    });

    const installationToken = await getInstallationToken(action.installationId);
    const installationRepos = await listInstallationRepositories(installationToken);
    const allowedRepoIds = new Set(visibleRepos.map((repo) => repo.id));
    const repos = installationRepos.filter((repo) => allowedRepoIds.has(repo.id));
    const firstRepo = repos[0] ?? visibleRepos[0];

    const installationDbId = await upsertGitHubInstallation({
      userId,
      installationId: action.installationId,
      accountLogin: firstRepo.owner.login,
      accountType: "User",
      repositorySelection: "selected"
    });

    await replaceInstallationRepositories(
      userId,
      installationDbId,
      repos.map((repo) => ({
        githubId: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch
      }))
    );

    const headers = new Headers({
      Location: `${serverEnv.APP_URL.replace(/\/$/, "")}/dashboard`
    });
    headers.append("Set-Cookie", buildSessionCookie(createSessionToken(userId)));
    headers.append("Set-Cookie", clearOAuthStateCookie());
    headers.append("Set-Cookie", clearPendingInstallationCookie());

    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error("GitHub callback failed", error);
    return redirectToSetup(
      "github_callback_failed",
      error instanceof Error ? error.message : "GitHub callback failed."
    );
  }
}

function redirectToSetup(reason: string, message: string, missing?: readonly string[]): Response {
  const headers = new Headers({
    Location: buildSetupUrl({ reason, from: "github-callback", missing })
  });
  headers.append("Set-Cookie", clearOAuthStateCookie());
  return new Response(null, { status: 302, headers });
}
