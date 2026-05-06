/**
 * Featured pins shown at the top of the /showcase board and used by the
 * supporter prompt. Each entry is rendered with a one-click "View on GitHub"
 * CTA — no automation, no token-based stars. Real humans choose to star.
 */

export type FeaturedRepo = {
  owner: string;
  repo: string;
  pitch: string;
};

export const FEATURED_REPOS: readonly FeaturedRepo[] = [
  {
    owner: "Kerim-Sabic",
    repo: "github-active",
    pitch: "The app you're using right now. Star to support free open-source dev tooling."
  }
];

export const PRIMARY_FEATURED_REPO = FEATURED_REPOS[0];
