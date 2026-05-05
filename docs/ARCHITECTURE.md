# Architecture

GitHub Active is built as a Netlify-native SaaS surface. The app keeps routing thin, pushes domain behavior into server modules, and makes job execution auditable.

## System Model

```text
Browser
  -> Next.js App Router
  -> GitHub App install / OAuth callback
  -> Drizzle ORM / Postgres
  -> Netlify Scheduled Function
  -> Netlify Background Function
  -> GitHub Contents API
```

## Core Boundaries

- `src/app`: pages and route handlers. This layer composes UI and delegates business behavior.
- `src/server/auth`: session cookies, signed OAuth state, GitHub install/login flow helpers.
- `src/server/github`: GitHub API clients for app installation tokens and manual token validation.
- `src/server/automation`: scheduler, deterministic content generator, dispatcher, and job runner.
- `src/server/db`: Drizzle schema and repository functions.
- `src/shared`: reusable UI primitives and small utilities.

## Job Flow

1. A user installs the GitHub App and authorizes GitHub Active.
2. The callback stores the GitHub user, installation, and selected repositories.
3. A user creates or updates an automation schedule.
4. `scheduler-dispatcher` runs every 10 minutes and plans due commits.
5. Each planned commit receives a unique idempotency key.
6. `execute-commit-background` claims one planned commit and writes it through the GitHub Contents API.
7. Job runs store success/failure, GitHub commit URL, and audit context.

## Auth Model

GitHub App auth is the production default because installation tokens are short-lived and repository-scoped. Manual token mode exists only as a validation fallback and does not store personal access tokens.

## Safety Invariants

- No hidden backdating.
- No PAT remote URLs in production.
- No browser-exposed installation tokens.
- No duplicate commits from worker retries.
- No fake achievements, synthetic stars, or scripted spam interactions.
