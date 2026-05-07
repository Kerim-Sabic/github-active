import { serverEnv } from "@/server/env";
import { isMaintainer } from "@/server/openai/maintainers";

export type ResolvedKey =
  | { kind: "byok"; key: string }
  | { kind: "maintainer"; key: string }
  | { kind: "missing" };

/**
 * Picks which OpenAI API key to use for an AI request.
 *
 * Order of preference:
 *  1. The `X-OpenAI-Key` request header — every signed-in user can BYOK.
 *  2. The maintainer env var, but ONLY if the signed-in user's GitHub
 *     login is in the MAINTAINERS allowlist.
 *  3. Missing → caller should respond 402 byok_required.
 */
export function resolveOpenAIKey(request: Request, login: string | null): ResolvedKey {
  const headerKey = request.headers.get("x-openai-key");
  if (headerKey && headerKey.startsWith("sk-")) {
    return { kind: "byok", key: headerKey };
  }

  if (isMaintainer(login) && serverEnv.OPENAI_API_KEY_MAINTAINER) {
    return { kind: "maintainer", key: serverEnv.OPENAI_API_KEY_MAINTAINER };
  }

  return { kind: "missing" };
}
