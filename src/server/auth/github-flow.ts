import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  createSignedToken,
  readSignedToken,
  oauthStateCookieName
} from "@/server/auth/session";
import { isProduction, serverEnv } from "@/server/env";

const GitHubFlowStateSchema = z.object({
  kind: z.enum(["install", "login"]),
  nonce: z.string().min(16),
  installationId: z.number().int().positive().optional(),
  issuedAt: z.number().int()
});

const PendingInstallationSchema = z.object({
  installationId: z.number().int().positive(),
  issuedAt: z.number().int()
});

export type GitHubFlowState = z.infer<typeof GitHubFlowStateSchema>;
export type PendingInstallation = z.infer<typeof PendingInstallationSchema>;

export const pendingInstallationCookieName = "github_active_pending_installation";

export type GitHubCallbackAction =
  | { action: "authorize-user"; installationId: number }
  | { action: "finish"; code: string; installationId: number }
  | { action: "error"; reason: GitHubCallbackErrorReason; message: string };

export type GitHubCallbackErrorReason =
  | "github_denied"
  | "state_mismatch"
  | "missing_code"
  | "missing_installation";

export function createGitHubFlowState(input: {
  kind: GitHubFlowState["kind"];
  installationId?: number | null;
}): string {
  return createSignedToken({
    kind: input.kind,
    nonce: randomBytes(24).toString("base64url"),
    installationId: input.installationId ?? undefined,
    issuedAt: Date.now()
  });
}

export function readGitHubFlowState(token: string | undefined): GitHubFlowState | null {
  if (!token) return null;
  const state = readSignedToken(token, GitHubFlowStateSchema);
  if (!state) return null;
  return Date.now() - state.issuedAt <= 10 * 60 * 1000 ? state : null;
}

export function buildPendingInstallationCookie(installationId: number): string {
  const token = createSignedToken({ installationId, issuedAt: Date.now() });
  return buildCookie(pendingInstallationCookieName, token, 15 * 60);
}

export function readPendingInstallation(token: string | undefined): PendingInstallation | null {
  if (!token) return null;
  const pending = readSignedToken(token, PendingInstallationSchema);
  if (!pending) return null;
  return Date.now() - pending.issuedAt <= 15 * 60 * 1000 ? pending : null;
}

export function clearPendingInstallationCookie(): string {
  return clearCookie(pendingInstallationCookieName);
}

export function parseInstallationId(value: string | null): number | null {
  if (!value) return null;
  const installationId = Number(value);
  return Number.isSafeInteger(installationId) && installationId > 0 ? installationId : null;
}

export function resolveGitHubCallback(input: {
  error: string | null;
  code: string | null;
  installationId: number | null;
  stateToken: string | null;
  stateCookie: string | undefined;
  pendingInstallationToken: string | undefined;
}): GitHubCallbackAction {
  if (input.error) {
    return {
      action: "error",
      reason: "github_denied",
      message: "GitHub authorization was cancelled or denied."
    };
  }

  const state = validateGitHubState(input.stateToken, input.stateCookie);
  if (!state) {
    return {
      action: "error",
      reason: "state_mismatch",
      message: "GitHub state validation failed. Start the connection again."
    };
  }

  if (input.installationId && !input.code) {
    return { action: "authorize-user", installationId: input.installationId };
  }

  if (!input.code) {
    return {
      action: "error",
      reason: "missing_code",
      message: "GitHub did not return an authorization code."
    };
  }

  const pendingInstallation = readPendingInstallation(input.pendingInstallationToken);
  const installationId = input.installationId ?? state.installationId ?? pendingInstallation?.installationId ?? null;

  if (!installationId) {
    return {
      action: "error",
      reason: "missing_installation",
      message: "GitHub did not identify an app installation for this authorization."
    };
  }

  return { action: "finish", code: input.code, installationId };
}

export function buildGitHubInstallUrl(appSlug: string, state: string): string {
  const url = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildGitHubLoginUrl(input: {
  clientId: string;
  appUrl?: string;
  state: string;
}): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", getGitHubCallbackUrl(input.appUrl));
  url.searchParams.set("state", input.state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function getGitHubCallbackUrl(appUrl = serverEnv.APP_URL): string {
  return `${appUrl.replace(/\/$/, "")}/api/github/callback`;
}

function validateGitHubState(stateToken: string | null, stateCookie: string | undefined): GitHubFlowState | null {
  if (!stateToken || !stateCookie || stateToken !== stateCookie) return null;
  return readGitHubFlowState(stateToken);
}

function buildCookie(name: string, value: string, maxAge: number): string {
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    isProduction() ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction() ? "; Secure" : ""}`;
}

export function buildGitHubStateCookie(state: string): string {
  return buildCookie(oauthStateCookieName, state, 10 * 60);
}
