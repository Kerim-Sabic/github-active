import {
  BookOpenCheck,
  Code2,
  GitPullRequest,
  HeartHandshake,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Star,
  Users
} from "lucide-react";

export const achievementGoals = [
  {
    id: "profile-readme",
    title: "Profile README",
    label: "Foundation",
    difficulty: "Easy",
    signal: "A clear username/username README that explains current work, stack, and proof links.",
    actions: [
      "Create the username/username repository if it does not exist.",
      "Write a concise profile README with current focus, featured work, and operating principles.",
      "Keep the README factual and update it when your public work changes."
    ],
    evidence: "Visible profile README commit",
    icon: BookOpenCheck
  },
  {
    id: "pull-shark",
    title: "Pull Shark",
    label: "Pull requests",
    difficulty: "Medium",
    signal: "Meaningful pull requests that get merged into real repositories.",
    actions: [
      "Find small issues in repositories you actually use.",
      "Open focused pull requests with tests, screenshots, or reproduction notes.",
      "Respond to review feedback and keep each PR easy to verify."
    ],
    evidence: "Merged pull requests",
    icon: GitPullRequest
  },
  {
    id: "galaxy-brain",
    title: "Galaxy Brain",
    label: "Discussions",
    difficulty: "Medium",
    signal: "Helpful answers in GitHub Discussions that maintainers or users accept.",
    actions: [
      "Answer questions where you can provide accurate implementation detail.",
      "Link to docs, source files, or minimal examples instead of guessing.",
      "Follow up when the asker clarifies the problem."
    ],
    evidence: "Accepted discussion answers",
    icon: MessageSquare
  },
  {
    id: "starstruck",
    title: "Starstruck",
    label: "Repository value",
    difficulty: "Hard",
    signal: "A repository useful enough that other developers star it organically.",
    actions: [
      "Polish one public repository so its value is obvious in the first viewport.",
      "Add a fast demo, clean README, install steps, screenshots, and a roadmap.",
      "Share the project in relevant communities without star swaps or spam."
    ],
    evidence: "Organic repository stars",
    icon: Star
  },
  {
    id: "pair-extraordinaire",
    title: "Pair Extraordinaire",
    label: "Collaboration",
    difficulty: "Medium",
    signal: "Real co-authored work with another developer.",
    actions: [
      "Pair on a scoped feature, bug fix, or documentation improvement.",
      "Use GitHub's co-authored-by trailer only when both people contributed.",
      "Document the problem solved and verification performed."
    ],
    evidence: "Co-authored commits",
    icon: Users
  },
  {
    id: "developer-program",
    title: "Developer Program Member",
    label: "Platform",
    difficulty: "Easy",
    signal: "Participation in GitHub's developer ecosystem and API tooling.",
    actions: [
      "Join the GitHub Developer Program with your real account.",
      "Build or document a small GitHub API integration.",
      "Link the integration from your profile or featured repository."
    ],
    evidence: "Developer Program badge",
    icon: Code2
  },
  {
    id: "public-sponsor",
    title: "Public Sponsor",
    label: "Support",
    difficulty: "Optional",
    signal: "Visible support for open source maintainers through GitHub Sponsors.",
    actions: [
      "Sponsor a maintainer or project you genuinely rely on.",
      "Keep the sponsorship public only if you are comfortable with that visibility.",
      "Mention the project honestly when explaining your open source ecosystem."
    ],
    evidence: "Public sponsorship profile signal",
    icon: HeartHandshake
  },
  {
    id: "heart-on-your-sleeve",
    title: "Heart On Your Sleeve",
    label: "Reactions",
    difficulty: "Easy",
    signal: "Genuine reactions that help maintainers triage useful issues, answers, and releases.",
    actions: [
      "React to issues, discussions, releases, or comments only when the reaction is meaningful.",
      "Use reactions to signal reproducibility, appreciation, or priority without adding noise.",
      "Avoid reaction bombing or coordinated engagement."
    ],
    evidence: "Authentic public reactions",
    icon: Lightbulb
  },
  {
    id: "repository-credibility",
    title: "Repository Credibility",
    label: "Trust",
    difficulty: "Medium",
    signal: "Pinned repositories with CI, license, security policy, and architecture notes.",
    actions: [
      "Add CI status, license, security policy, issue templates, and contribution notes.",
      "Document architecture decisions and deployment constraints.",
      "Keep the default branch green before sharing the project widely."
    ],
    evidence: "Professional public repository surface",
    icon: Sparkles
  },
  {
    id: "community-proof",
    title: "Community Proof",
    label: "Reputation",
    difficulty: "Long term",
    signal: "Useful issues, reviews, and discussions that make projects better.",
    actions: [
      "Open issues with reproduction steps and expected behavior.",
      "Review pull requests with specific risks and test gaps.",
      "Avoid generic comments, empty issues, or engagement bait."
    ],
    evidence: "Useful public collaboration history",
    icon: HeartHandshake
  },
  {
    id: "visibility-settings",
    title: "Achievement Visibility",
    label: "Settings",
    difficulty: "Easy",
    signal: "Profile settings allow public achievements and selected contribution visibility.",
    actions: [
      "Review GitHub profile contribution settings.",
      "Show achievements intentionally, and choose whether private contributions should count.",
      "Keep privacy choices explicit rather than accidental."
    ],
    evidence: "Correct profile visibility settings",
    icon: Lightbulb
  }
] as const;

export const achievementGoalIds = achievementGoals.map((goal) => goal.id) as [
  AchievementGoal["id"],
  ...Array<AchievementGoal["id"]>
];

export type AchievementGoal = (typeof achievementGoals)[number];
export type AchievementGoalId = AchievementGoal["id"];

export function getAchievementGoals(ids: readonly AchievementGoalId[]): AchievementGoal[] {
  const selected = new Set(ids);
  return achievementGoals.filter((goal) => selected.has(goal.id));
}
