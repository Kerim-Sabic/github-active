import { z } from "zod";

/**
 * GitHub Discussions only exposes structured access through GraphQL.
 * Minimal wrapper here — no schema discovery, just the two queries the
 * Galaxy Brain Hunter needs.
 */

const SearchSchema = z.object({
  data: z.object({
    search: z.object({
      issueCount: z.number().optional(),
      nodes: z.array(
        z.object({
          __typename: z.string().optional(),
          title: z.string().optional(),
          number: z.number().optional(),
          url: z.string().optional(),
          updatedAt: z.string().optional(),
          createdAt: z.string().optional(),
          bodyText: z.string().optional(),
          author: z.object({ login: z.string().nullable().optional() }).nullable().optional(),
          repository: z
            .object({
              nameWithOwner: z.string().optional(),
              owner: z.object({ login: z.string() }).optional(),
              name: z.string().optional(),
              primaryLanguage: z.object({ name: z.string() }).nullable().optional(),
              stargazerCount: z.number().optional()
            })
            .optional(),
          comments: z.object({ totalCount: z.number().optional() }).optional(),
          answer: z.unknown().nullable().optional(),
          category: z.object({ name: z.string() }).nullable().optional()
        })
      )
    })
  })
});

export type DiscussionSummary = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  bodyExcerpt: string;
  updatedAt: string;
  category: string | null;
  language: string | null;
  comments: number;
  stars: number;
  hasAnswer: boolean;
};

export async function searchDiscussions(input: {
  token: string;
  languages: string[];
  perPage?: number;
  daysBack?: number;
}): Promise<DiscussionSummary[]> {
  const perPage = input.perPage ?? 30;
  const daysBack = input.daysBack ?? 45;
  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const langClauses = input.languages.length
    ? input.languages.map((l) => `language:${quote(l)}`).join(" ")
    : "";

  const query = `is:discussion is:open updated:>=${sinceDate} ${langClauses}`.trim();

  const gql = `
    query Search($q: String!, $first: Int!) {
      search(query: $q, type: DISCUSSION, first: $first) {
        issueCount
        nodes {
          __typename
          ... on Discussion {
            title
            number
            url
            updatedAt
            createdAt
            bodyText
            author { login }
            repository {
              nameWithOwner
              owner { login }
              name
              primaryLanguage { name }
              stargazerCount
            }
            comments { totalCount }
            answer { __typename }
            category { name }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "github-active-netlify-saas"
    },
    body: JSON.stringify({ query: gql, variables: { q: query, first: Math.min(perPage, 50) } })
  });

  if (!response.ok) return [];
  const raw: unknown = await response.json();
  const parsed = SearchSchema.safeParse(raw);
  if (!parsed.success) return [];

  return parsed.data.data.search.nodes
    .filter((n) => n.__typename === "Discussion" && n.repository?.owner)
    .filter((n) => (n.comments?.totalCount ?? 0) <= 4)
    .filter((n) => !n.answer)
    .filter((n) => (n.repository?.stargazerCount ?? 0) >= 25)
    .map((n) => ({
      owner: n.repository?.owner?.login ?? "",
      repo: n.repository?.name ?? "",
      number: n.number ?? 0,
      title: n.title ?? "",
      url: n.url ?? "",
      bodyExcerpt: (n.bodyText ?? "").slice(0, 800),
      updatedAt: n.updatedAt ?? "",
      category: n.category?.name ?? null,
      language: n.repository?.primaryLanguage?.name ?? null,
      comments: n.comments?.totalCount ?? 0,
      stars: n.repository?.stargazerCount ?? 0,
      hasAnswer: false
    }));
}

const SingleDiscussionSchema = z.object({
  data: z.object({
    repository: z
      .object({
        defaultBranchRef: z.object({ name: z.string() }).nullable().optional(),
        primaryLanguage: z.object({ name: z.string() }).nullable().optional(),
        discussion: z
          .object({
            number: z.number(),
            title: z.string(),
            url: z.string(),
            bodyText: z.string(),
            author: z.object({ login: z.string().nullable() }).nullable().optional(),
            category: z.object({ name: z.string() }).nullable().optional(),
            comments: z
              .object({
                nodes: z.array(
                  z.object({
                    bodyText: z.string(),
                    author: z.object({ login: z.string().nullable() }).nullable().optional()
                  })
                )
              })
              .optional()
          })
          .nullable()
          .optional()
      })
      .nullable()
  })
});

export type DiscussionDetails = {
  number: number;
  title: string;
  url: string;
  bodyText: string;
  category: string | null;
  authorLogin: string | null;
  comments: Array<{ author: string | null; body: string }>;
  primaryLanguage: string | null;
  defaultBranch: string | null;
};

export async function getDiscussion(input: {
  token: string;
  owner: string;
  repo: string;
  number: number;
}): Promise<DiscussionDetails | null> {
  const gql = `
    query Get($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef { name }
        primaryLanguage { name }
        discussion(number: $number) {
          number
          title
          url
          bodyText
          author { login }
          category { name }
          comments(first: 8) {
            nodes { bodyText author { login } }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "github-active-netlify-saas"
    },
    body: JSON.stringify({
      query: gql,
      variables: { owner: input.owner, name: input.repo, number: input.number }
    })
  });
  if (!response.ok) return null;

  const raw: unknown = await response.json();
  const parsed = SingleDiscussionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const repo = parsed.data.data.repository;
  if (!repo?.discussion) return null;

  return {
    number: repo.discussion.number,
    title: repo.discussion.title,
    url: repo.discussion.url,
    bodyText: repo.discussion.bodyText,
    category: repo.discussion.category?.name ?? null,
    authorLogin: repo.discussion.author?.login ?? null,
    comments: (repo.discussion.comments?.nodes ?? []).map((n) => ({
      author: n.author?.login ?? null,
      body: n.bodyText
    })),
    primaryLanguage: repo.primaryLanguage?.name ?? null,
    defaultBranch: repo.defaultBranchRef?.name ?? null
  };
}

function quote(s: string): string {
  if (/^[A-Za-z0-9.+#-]+$/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}
