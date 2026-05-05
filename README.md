# GitHub Active

> A Netlify-native command center for transparent developer journal automation on user-owned GitHub repositories.

[![Live](https://img.shields.io/badge/live-githubactive.netlify.app-23C55E?style=for-the-badge)](https://githubactive.netlify.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![Netlify](https://img.shields.io/badge/Netlify-Scheduled%20Workers-00AD9F?style=for-the-badge&logo=netlify)](https://www.netlify.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-22C55E?style=for-the-badge)](./LICENSE)

GitHub Active turns a local activity bot into a public SaaS surface with GitHub App auth, deterministic commit previews, retry-safe scheduled workers, audit history, and a technical dashboard that makes automation explicit instead of hidden.

It is designed for developer journaling, learning logs, and transparent repository activity in repos the user owns or intentionally selects. It does **not** support hidden backdating, fake achievement farming, synthetic stars, spam pull requests, or deceptive contribution claims.

## Product Surface

- **Public app:** minimal technical landing page with animated GitHub-style activity tiles.
- **Dashboard:** repository health, schedule controls, previews, run-now, pause/resume, and recent jobs.
- **Setup console:** redacted production readiness for GitHub App, Netlify Database, session secrets, and worker secrets.
- **Connect screen:** clear Automatic mode vs Manual mode instead of a raw production-credentials error.
- **Manual mode:** fine-grained token validation and one transparent journal commit, without storing tokens.
- **Achievement Lab:** ethical profile-growth roadmap plus a working profile README updater for real GitHub profile improvement.

## Architecture

```text
Next.js App Router
  -> GitHub App install / OAuth callback
  -> Drizzle ORM / Netlify Database
  -> Netlify Scheduled Function dispatcher
  -> Netlify Background Function commit worker
  -> GitHub Contents API
```

Core properties:

- GitHub App installation tokens are generated on demand and never exposed to the browser.
- Planned commits use deterministic seeds so previews match execution.
- Worker execution is idempotent through unique planned-commit keys.
- Setup status is redacted and safe to expose publicly.
- Manual token mode validates credentials once and does not persist PATs.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the system model.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js App Router, React 19 |
| Styling | Tailwind CSS v4, OKLCH tokens, lucide icons |
| Validation | Zod schemas at API and domain boundaries |
| Persistence | Drizzle ORM on Netlify Database / Postgres |
| Jobs | Netlify Scheduled Functions and Background Functions |
| Auth | GitHub App installation auth plus OAuth user authorization |
| Tests | Vitest for scheduler, config, auth flow, setup status, policy logic |

## Production Setup

GitHub Active needs real production credentials before `Connect GitHub` can redirect to GitHub. If these are missing, the live app intentionally redirects to `/setup` instead of returning a blank 500.

```env
APP_URL=https://githubactive.netlify.app
SESSION_SECRET=replace_with_at_least_32_random_characters
INTERNAL_JOB_SECRET=replace_with_at_least_16_random_characters
NETLIFY_DATABASE_URL=postgres_connection_string
SUPABASE_DATABASE_URL=optional_supabase_postgres_connection_string
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me

GITHUB_APP_SLUG=your-github-app-slug
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_APP_CLIENT_SECRET=github_app_client_secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

GitHub App settings:

- Callback URL: `https://githubactive.netlify.app/api/github/callback`
- Setup URL: `https://githubactive.netlify.app/api/github/callback`
- Repository permissions: `Contents: Read and write`, `Metadata: Read`
- User authorization: enabled

Apply the schema:

```bash
psql "$NETLIFY_DATABASE_URL" -f drizzle/0000_initial.sql
```

Full checklist: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Without database and GitHub App env vars, the app renders demo dashboard data and setup guidance.

## Verification

```bash
npm run typecheck
npm run test
npm run build
npm audit
```

Expected current result:

- TypeScript passes.
- Vitest passes.
- Next.js production build passes.
- npm audit reports no moderate-or-higher vulnerabilities.

## Repository Quality

This repo includes:

- CI workflow for typecheck, tests, build, and audit.
- Issue templates for bugs and feature requests.
- Pull request template with validation checklist.
- Security policy and contribution guide.
- Architecture, deployment, manual mode, and Achievement Lab documentation.

## Safety Positioning

GitHub Active is for transparent developer journaling and user-owned repositories. Users explicitly select repositories, preview generated content, configure schedules, and keep audit records.

Achievement Lab is an ethical roadmap for profile quality. It can create a real profile README commit in the user's own `username/username` repository and helps users understand legitimate profile signals and visibility settings; it does not automate badge manipulation or spam behavior.

## License

Licensed under the [BSD 3-Clause License](./LICENSE).

Copyright notices and attribution to `Kerim-Sabic` must be preserved in redistributions, forks, and substantial portions of the software.
