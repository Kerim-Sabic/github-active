# GitHub Active

GitHub Active is a polished Netlify SaaS for transparent developer journal automation on user-owned GitHub repositories. Users install a GitHub App, preview generated technical content, configure schedules, and let Netlify run the work even when their device is off.

![GitHub Active](https://img.shields.io/badge/GitHub%20Active-Netlify%20SaaS-00A6C8?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge)
![License](https://img.shields.io/badge/License-BSD%203--Clause-green?style=for-the-badge)

## Highlights

- Public landing page with a clean, technical product feel.
- Dashboard-first app experience with repo health, previews, schedules, run-now controls, and audit history.
- GitHub App authentication instead of personal access tokens.
- Netlify Scheduled Function dispatcher plus background commit worker.
- Drizzle/Postgres schema for users, installations, repositories, schedules, planned commits, job runs, and audit events.
- Deterministic scheduler and content generator so previewed content matches executed jobs.
- Zero production npm audit vulnerabilities at the time of publishing.

## Stack

- Next.js App Router
- React 19
- Tailwind CSS v4 with OKLCH design tokens
- Radix Slot primitives
- Lucide icons
- Zod validation
- Drizzle ORM
- Netlify Functions
- Netlify Database / Postgres

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Without database and GitHub App environment variables, the app renders demo dashboard data so the interface can be reviewed safely.

## Production Environment

```env
APP_URL=https://your-site.netlify.app
SESSION_SECRET=replace_with_at_least_32_random_characters
INTERNAL_JOB_SECRET=replace_with_at_least_16_random_characters
NETLIFY_DATABASE_URL=postgres_connection_string

GITHUB_APP_SLUG=your-github-app-slug
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_APP_CLIENT_SECRET=github_app_client_secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

GitHub App setup:

- Enable user authorization during installation.
- Callback URL: `https://your-site.netlify.app/api/github/callback`
- Setup URL: `https://your-site.netlify.app/api/github/callback`
- Repository permissions: `Contents: Read and write`, `Metadata: Read`.
- Users should select only repositories they own or intentionally want automated.

Production checklist for `https://githubactive.netlify.app`:

- Set the Netlify environment variables above in the production context.
- Apply `drizzle/0000_initial.sql` to the Netlify Database/Postgres connection.
- Create or update one GitHub App for GitHub Active.
- Set the GitHub App Callback URL to `https://githubactive.netlify.app/api/github/callback`.
- Set the GitHub App Setup URL to `https://githubactive.netlify.app/api/github/callback`.
- Enable the install OAuth flow or let the app redirect through `/api/github/login` after installation.
- Confirm `https://githubactive.netlify.app/api/setup/status` reports all required checks as configured before sharing the public link.
- If `/api/github/install` cannot start safely, users are redirected to `/setup` instead of receiving a blank server error.

## Database

The Drizzle ORM schema lives in `src/server/db/schema.ts`. Apply the initial SQL migration with:

```bash
psql "$NETLIFY_DATABASE_URL" -f drizzle/0000_initial.sql
```

## Verification

```bash
npm run typecheck
npm run test
npm run build
npm audit
```

Expected current result:

- TypeScript passes.
- 7 Vitest checks pass.
- Next.js production build passes.
- npm audit reports 0 vulnerabilities.

## Netlify Functions

- `netlify/functions/scheduler-dispatcher.ts` runs every 10 minutes and queues due work.
- `netlify/functions/execute-commit-background.ts` claims one planned commit and writes it through the GitHub Contents API.

## Safety Positioning

GitHub Active is designed for transparent developer journaling and user-owned repositories. It does not support hidden backdating or deceptive contribution claims. Users explicitly select repositories, preview generated content, configure schedules, and keep audit records.

## License

Licensed under the BSD 3-Clause License.

Copyright notices and attribution to `Kerim-Sabic` must be preserved in redistributions, forks, and substantial portions of the software.
