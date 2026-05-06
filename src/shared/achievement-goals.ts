import {
  BookOpenCheck,
  GitPullRequest,
  HeartHandshake,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Star,
  Timer,
  Users,
  Zap
} from "lucide-react";

export type AchievementKind = "automatable" | "social" | "manual";
export type AchievementAutomation = "pull-shark" | "yolo" | "quickdraw" | "pair-extraordinaire";

export type AchievementGoal = {
  id: string;
  title: string;
  label: string;
  difficulty: string;
  signal: string;
  actions: readonly string[];
  evidence: string;
  kind: AchievementKind;
  automation?: AchievementAutomation;
  tiers?: readonly number[];
  socialReason?: string;
  socialAction?: { label: string; href: string };
  icon: typeof GitPullRequest;
};

export const achievementGoals: readonly AchievementGoal[] = [
  {
    id: "pull-shark",
    title: "Pull Shark",
    label: "Pull requests",
    difficulty: "Auto",
    signal: "Open and merge pull requests in a real repository.",
    actions: [
      "Lab creates a branch in your github-active-sandbox repo.",
      "Lab commits a journal file, opens a PR, and squash-merges it.",
      "Repeat for every PR in the run (default 2, max 16 per click)."
    ],
    evidence: "Merged pull requests in your sandbox repo",
    kind: "automatable",
    automation: "pull-shark",
    tiers: [1, 2, 16, 128, 1024],
    icon: GitPullRequest
  },
  {
    id: "yolo",
    title: "YOLO",
    label: "Pull requests",
    difficulty: "Auto",
    signal: "Merge a pull request without requesting any reviews.",
    actions: [
      "Same flow as Pull Shark, but the PR is merged immediately with zero reviewers.",
      "GitHub awards YOLO when reviews_count = 0 at merge time."
    ],
    evidence: "PR merged with no reviewers",
    kind: "automatable",
    automation: "yolo",
    icon: Zap
  },
  {
    id: "quickdraw",
    title: "Quickdraw",
    label: "Speed",
    difficulty: "Auto",
    signal: "Close an issue or pull request within 5 minutes of opening it.",
    actions: [
      "Lab opens an issue in the sandbox repo.",
      "Lab closes the issue a couple of seconds later — well under the 5-minute window."
    ],
    evidence: "Issue closed within 5 minutes",
    kind: "automatable",
    automation: "quickdraw",
    icon: Timer
  },
  {
    id: "pair-extraordinaire",
    title: "Pair Extraordinaire",
    label: "Collaboration",
    difficulty: "Auto",
    signal: "Co-author a commit with another GitHub user.",
    actions: [
      "Provide the GitHub username of the developer you want to credit.",
      "Lab fetches their public account, then commits with a Co-authored-by trailer."
    ],
    evidence: "Co-authored commit landed",
    kind: "automatable",
    automation: "pair-extraordinaire",
    icon: Users
  },
  {
    id: "galaxy-brain",
    title: "Galaxy Brain",
    label: "Discussions",
    difficulty: "Social",
    signal: "Have an answer accepted in a public GitHub Discussion.",
    actions: [
      "Find a recent question in a project's Discussions tab.",
      "Post a substantive answer with code references and minimal repros.",
      "Wait for the maintainer or asker to mark your answer as accepted."
    ],
    evidence: "Maintainer-accepted discussion answer",
    kind: "social",
    socialReason:
      "Galaxy Brain requires another GitHub user to mark your answer as the accepted solution. The lab cannot fake that — and trying to would just create empty Discussions in throwaway repos that GitHub does not count.",
    socialAction: {
      label: "Browse open Discussions",
      href: "https://github.com/discussions"
    },
    icon: MessageSquare
  },
  {
    id: "starstruck",
    title: "Starstruck",
    label: "Stars",
    difficulty: "Social",
    signal: "Have a repository hit 16 / 128 / 512 / 4096 stars.",
    actions: [
      "Polish one public repo so the value is obvious in the first viewport.",
      "Add a clear README, screenshots, install steps, demo gif, and a roadmap.",
      "Share it where the audience already lives — Hacker News, Reddit, Twitter, your network."
    ],
    evidence: "Organic stars from real developers",
    kind: "social",
    socialReason:
      "Stars need to come from real GitHub accounts to count. Star-swap rings get banned, and the lab refuses to coordinate them.",
    socialAction: {
      label: "Read GitHub's repo discoverability guide",
      href: "https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories"
    },
    icon: Star
  },
  {
    id: "heart-on-your-sleeve",
    title: "Heart On Your Sleeve",
    label: "Reactions",
    difficulty: "Social",
    signal: "Receive 10 / 50 / 500 / 4000 reactions across your comments.",
    actions: [
      "Post genuinely helpful comments on issues, PRs, and discussions.",
      "Triage reproduction bugs, share clean repros, propose fixes."
    ],
    evidence: "Reactions from other developers",
    kind: "social",
    socialReason:
      "Reactions have to come from other users on your comments — the lab cannot react to itself.",
    icon: HeartHandshake
  },
  {
    id: "public-sponsor",
    title: "Public Sponsor",
    label: "Sponsorship",
    difficulty: "Social",
    signal: "Sponsor an open-source maintainer through GitHub Sponsors.",
    actions: [
      "Pick a maintainer or project you actually rely on.",
      "Set up a recurring or one-time public sponsorship from your settings."
    ],
    evidence: "Public sponsorship on your profile",
    kind: "social",
    socialReason:
      "Sponsoring is a real payment to a real human. The lab will not — and cannot — automate that for you.",
    socialAction: {
      label: "Open GitHub Sponsors",
      href: "https://github.com/sponsors"
    },
    icon: Sparkles
  },
  {
    id: "profile-readme",
    title: "Profile README",
    label: "Foundation",
    difficulty: "Manual",
    signal: "Publish a clear username/username README that explains your work.",
    actions: [
      "The lab writes a structured README into your username/username repo.",
      "You stay in control of the headline, focus, and featured project."
    ],
    evidence: "Visible profile README commit",
    kind: "manual",
    icon: BookOpenCheck
  },
  {
    id: "repository-credibility",
    title: "Repository Credibility",
    label: "Trust",
    difficulty: "Manual",
    signal: "Pinned repos with CI, license, security policy, and architecture notes.",
    actions: [
      "Add CI status, license, security policy, contribution notes.",
      "Document architecture decisions and deployment constraints.",
      "Keep the default branch green before sharing the project widely."
    ],
    evidence: "Professional public repository surface",
    kind: "manual",
    icon: Lightbulb
  }
];

export type AchievementGoalId = (typeof achievementGoals)[number]["id"];

export const achievementGoalIds = achievementGoals.map((goal) => goal.id) as [
  AchievementGoalId,
  ...AchievementGoalId[]
];

export function getAchievementGoals(ids: readonly AchievementGoalId[]): AchievementGoal[] {
  const selected = new Set(ids);
  return achievementGoals.filter((goal) => selected.has(goal.id));
}

export const automatableAchievements = achievementGoals.filter(
  (goal): goal is AchievementGoal & { automation: AchievementAutomation } =>
    goal.kind === "automatable" && Boolean(goal.automation)
);

export const socialAchievements = achievementGoals.filter((goal) => goal.kind === "social");
export const manualAchievements = achievementGoals.filter((goal) => goal.kind === "manual");
