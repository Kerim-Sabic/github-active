import { cookies } from "next/headers";
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
  listInstallationRepositories
} from "@/server/github/client";
import {
  replaceInstallationRepositories,
  upsertGitHubInstallation,
  upsertGitHubUser
} from "@/server/db/repository";
import { serverEnv } from "@/server/env";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const installationId = Number(url.searchParams.get("installation_id"));
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(oauthStateCookieName)?.value;

  if (!state || !expectedState || state !== expectedState) {
    return callbackError("GitHub state validation failed.");
  }

  if (!code || !Number.isFinite(installationId)) {
    return callbackError("GitHub App must request user authorization and include an installation_id.");
  }

  const userToken = await exchangeCodeForUserToken(code);
  const user = await getGitHubUser(userToken);
  const userId = await upsertGitHubUser({
    githubUserId: user.id,
    login: user.login,
    avatarUrl: user.avatar_url,
    name: user.name ?? null,
    email: user.email ?? null
  });

  const installationToken = await getInstallationToken(installationId);
  const repos = await listInstallationRepositories(installationToken);
  const firstRepo = repos[0];
  const installationDbId = await upsertGitHubInstallation({
    userId,
    installationId,
    accountLogin: firstRepo?.owner.login ?? user.login,
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

  const token = createSessionToken(userId);
  const headers = new Headers({
    Location: `${serverEnv.APP_URL.replace(/\/$/, "")}/dashboard`
  });
  headers.append("Set-Cookie", buildSessionCookie(token));
  headers.append("Set-Cookie", clearOAuthStateCookie());

  return new Response(null, { status: 302, headers });
}

function callbackError(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}
