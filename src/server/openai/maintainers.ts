/**
 * Hardcoded list of GitHub logins eligible to use the maintainer's OpenAI
 * key (`OPENAI_API_KEY_MAINTAINER` env var) without bringing their own.
 *
 * Anyone not in this list must paste their own OpenAI key in /settings.
 * The maintainer key is never returned to the client.
 */
export const MAINTAINERS: readonly string[] = ["Kerim-Sabic"];

export function isMaintainer(login: string | null | undefined): boolean {
  if (!login) return false;
  return MAINTAINERS.some((m) => m.toLowerCase() === login.toLowerCase());
}
