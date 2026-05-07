/**
 * Featured pins shown at the top of the /showcase board and used by the
 * supporter prompt. The supporter prompt always asks for a star on the
 * primary repo; the /showcase pulls every public repo owned by the listed
 * owner(s) so users discover them naturally.
 *
 * Real humans choose to star. No automation, no token-based stars.
 */

export type FeaturedRepo = {
  owner: string;
  repo: string;
  pitch: string;
};

export const PRIMARY_FEATURED_REPO: FeaturedRepo = {
  owner: "Kerim-Sabic",
  repo: "github-active",
  pitch: "The app you're using right now. Star to support free open-source dev tooling."
};

export const FEATURED_REPOS: readonly FeaturedRepo[] = [PRIMARY_FEATURED_REPO];

/**
 * Owners whose ENTIRE public repo list gets pulled into the showcase
 * "Featured by the maker" row. The primary featured repo always pins to
 * the very top regardless of star count.
 */
export const FEATURED_OWNERS: readonly string[] = ["Kerim-Sabic"];

/**
 * How many repos per owner to pull at most, sorted by star count.
 */
export const FEATURED_PER_OWNER = 6;
