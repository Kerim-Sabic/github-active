import { githubHeaders } from "@/server/github/client";

/**
 * Returns true if the authenticated user has starred {owner}/{repo}.
 * GitHub's `/user/starred/{owner}/{repo}` endpoint returns 204 if starred,
 * 404 otherwise.
 */
export async function hasUserStarred(
  token: string,
  owner: string,
  repo: string
): Promise<boolean> {
  const response = await fetch(
    `https://api.github.com/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: githubHeaders(token) }
  );
  if (response.status === 204) return true;
  if (response.status === 404) return false;
  // Treat anything else (rate-limited, transient) as "unknown" → false. The
  // caller will retry on subsequent page loads while the prompt window is open.
  return false;
}
