import { describe, expect, it } from "vitest";
import {
  buildPendingInstallationCookie,
  createGitHubFlowState,
  pendingInstallationCookieName,
  resolveGitHubCallback
} from "@/server/auth/github-flow";

describe("GitHub callback flow", () => {
  it("continues to OAuth when installation callback has no code", () => {
    const state = createGitHubFlowState({ kind: "install" });
    const action = resolveGitHubCallback({
      error: null,
      code: null,
      installationId: 42,
      stateToken: state,
      stateCookie: state,
      pendingInstallationToken: undefined
    });

    expect(action).toEqual({ action: "authorize-user", installationId: 42 });
  });

  it("finishes immediately when GitHub returns code and installation id", () => {
    const state = createGitHubFlowState({ kind: "install" });
    const action = resolveGitHubCallback({
      error: null,
      code: "oauth-code",
      installationId: 42,
      stateToken: state,
      stateCookie: state,
      pendingInstallationToken: undefined
    });

    expect(action).toEqual({ action: "finish", code: "oauth-code", installationId: 42 });
  });

  it("uses pending installation when OAuth callback only returns code", () => {
    const state = createGitHubFlowState({ kind: "login" });
    const pending = extractCookieValue(buildPendingInstallationCookie(84));
    const action = resolveGitHubCallback({
      error: null,
      code: "oauth-code",
      installationId: null,
      stateToken: state,
      stateCookie: state,
      pendingInstallationToken: pending
    });

    expect(action).toEqual({ action: "finish", code: "oauth-code", installationId: 84 });
  });

  it("rejects state mismatches", () => {
    const state = createGitHubFlowState({ kind: "install" });
    const otherState = createGitHubFlowState({ kind: "install" });
    const action = resolveGitHubCallback({
      error: null,
      code: "oauth-code",
      installationId: 42,
      stateToken: state,
      stateCookie: otherState,
      pendingInstallationToken: undefined
    });

    expect(action.action).toBe("error");
    expect(action).toMatchObject({ reason: "state_mismatch" });
  });
});

function extractCookieValue(cookie: string): string {
  const prefix = `${pendingInstallationCookieName}=`;
  const value = cookie
    .split(";")
    .find((part) => part.trim().startsWith(prefix))
    ?.trim()
    .slice(prefix.length);

  if (!value) throw new Error("Pending installation cookie was not created.");
  return value;
}
