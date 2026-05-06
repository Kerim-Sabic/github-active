<div align="center">

# GitHub Active

### Earn GitHub achievements at the click of a button. Your sandbox repo does the work.

[![Live](https://img.shields.io/badge/live-githubactive.netlify.app-22C55E?style=flat-square)](https://githubactive.netlify.app)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![Supabase Auth](https://img.shields.io/badge/Supabase-Auth-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![BSD-3](https://img.shields.io/badge/license-BSD--3--Clause-blue?style=flat-square)](./LICENSE)

</div>

---

GitHub Active is a one-click runner for the GitHub achievements that *can* be auto-earned, and an honest field guide for the ones that can&apos;t.

Sign in with GitHub. Click **Pull Shark**. The app creates branches, opens PRs, and squash-merges them inside a dedicated `github-active-sandbox` repo on your account. GitHub awards the achievement minutes later.

```
00:00  resolving sandbox repo
00:01  branch bot/ps-1731-1 created from main
00:02  entries/ps-1731-1.md committed
00:03  pr #142 opened
00:04  pr #142 merged (squash)
...
00:09  done · 2 PRs merged · pull shark eta ~15m
```

## Three things it does

- **Achievement Lab** — one-click runners for **Pull Shark**, **YOLO**, **Quickdraw**, and **Pair Extraordinaire**. Real branches, real PRs, real merges. All confined to a `github-active-sandbox` repo so your real projects stay clean.
- **Honest social section** — Galaxy Brain, Starstruck, Heart-on-Sleeve, and Public Sponsor *can&apos;t* be automated. The lab says so out loud and links you to the legitimate path for each.
- **Profile polish** — opt-in `username/username` README writer for when you want a clean, structured profile landing page.

It also ships an optional GitHub-App-powered scheduled-commit feature for transparent developer journaling — but the headline experience is the click-to-earn lab.

## Achievements supported

| Achievement | Tiers | Method | Status |
| --- | --- | --- | --- |
| **Pull Shark** | 1 / 2 / 16 / 128 / 1024 | One-click runner — branch + PR + squash merge × N | ✅ Auto |
| **YOLO** | 1 | Same as Pull Shark, merged with zero reviews | ✅ Auto |
| **Quickdraw** | 1 | Issue opened, then closed within seconds | ✅ Auto |
| **Pair Extraordinaire** | 1 / 10 / 24 | Co-authored commit credited to a real GitHub user you name | ✅ Auto |
| Galaxy Brain | 2 / 8 / 32 / 64 | Needs a maintainer to mark *your* answer accepted | ⚠ Social |
| Starstruck | 16 / 128 / 512 / 4096 | Needs organic stars from real developers | ⚠ Social |
| Heart On Your Sleeve | 10 / 50 / 500 / 4000 | Needs reactions from other users on *your* comments | ⚠ Social |
| Public Sponsor | 1 | Real GitHub Sponsors payment to a real maintainer | ⚠ Social |

## How it works

```text
                              ┌───────────────────────────────────────────────┐
 you                          │  github-active                                │
 ┌────────┐  Sign in (OAuth)  │  ┌─────────────────────────────────────────┐  │
 │ GitHub │ ────────────────▶ │  │ Supabase Auth · provider_token (repo)   │  │
 └────────┘ ◀──────────────── │  └─────────────────────────────────────────┘  │
                              │                  │                            │
                              │                  ▼                            │
                              │  ┌─────────────────────────────────────────┐  │
                              │  │ POST /api/achievements/run · SSE stream │  │
                              │  └─────────────────────────────────────────┘  │
                              │                  │                            │
                              │                  ▼                            │
 ┌─────────────────────────┐  │  ┌─────────────────────────────────────────┐  │
 │ github-active-sandbox   │ ◀── ┤ branches · PRs · merges · issues        │  │
 │ (auto-created)          │  │  └─────────────────────────────────────────┘  │
 └─────────────────────────┘  └───────────────────────────────────────────────┘
                  │
                  ▼
       GitHub awards the achievement (~15 min)
```

The OAuth `provider_token` lives only in your Supabase session cookie. It is never written to our database. Lab actions run server-side per click — there is no background worker, no scheduled job, and no stored credential.

## 60-second start

```bash
# 1. clone
git clone https://github.com/Kerim-Sabic/github-active.git
cd github-active

# 2. fill four env vars
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#   APP_URL=http://localhost:3000
#   SESSION_SECRET (32+ chars)

# 3. install + run
npm install
npm run dev
```

In your Supabase dashboard:

1. **Auth → Providers → GitHub** — enable the provider with your GitHub OAuth app credentials.
2. In the same panel, set **Additional Scopes** to: `read:user user:email repo`.
   This is required — Supabase enforces a server-side allowlist; the client-side `scopes` parameter is not enough on its own.

In your GitHub OAuth app settings, leave **"Expire user authorization tokens"** off (the default) so the same token keeps powering lab runs across visits.

Open http://localhost:3000, click **Sign in with GitHub**, then **Open Achievement Lab**. Click **Run Pull Shark**. Done.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Turbopack) · React 19 |
| Styling | Tailwind CSS v4 · OKLCH tokens · Linear-flavored dark theme |
| Auth | Supabase GitHub OAuth (`repo` scope) — primary; GitHub App available as advanced track |
| GitHub API | Raw `fetch` + Zod schemas — no Octokit, no abstraction debt |
| Persistence | Drizzle ORM on Postgres (Netlify DB / Supabase / self-hosted) |
| Streaming | Server-Sent Events for live run console |
| Tests | Vitest |

## Project structure

```
src/
├── app/
│   ├── achievements/             # /achievements — the Lab page + client + README form
│   ├── api/
│   │   ├── achievements/run/     # SSE orchestrator — one route, four flows
│   │   ├── supabase/{github,callback}/
│   │   └── github/{install,login,callback}/
│   ├── connect/, dashboard/, manual/, setup/
│   ├── layout.tsx                # Mounts the contribution-grid backdrop globally
│   └── page.tsx                  # Landing
├── server/
│   ├── auth/
│   │   ├── provider-token.ts     # Reads Supabase provider_token server-side
│   │   └── supabase-session.ts
│   └── github/
│       ├── client.ts             # OAuth + Contents API + headers helper
│       ├── mutations.ts          # branch / PR / issue / merge primitives (Zod-validated)
│       └── sandbox.ts            # ensureSandboxRepo()
├── shared/
│   ├── achievement-goals.ts      # Single source of truth for the 10 goals
│   └── ui/                       # button · card · input · badge · activity-backdrop
└── utils/supabase/{server,client}.ts
```

## Verification

```bash
npm run typecheck   # strict TS
npm run test        # vitest
npm run build       # next build (Turbopack)
```

End-to-end manual check:

1. `npm run dev`, sign in with GitHub.
2. `/achievements` → click Run on Pull Shark with count = 2.
3. SSE log streams: branch → commit → PR opened → merged. Twice.
4. Visit `https://github.com/<your-login>/github-active-sandbox/pulls?q=is:merged`.
5. Wait ~15 minutes, check `https://github.com/<your-login>?tab=achievements`.

## Why this exists

Most "GitHub achievement bot" projects are either:

- Vanity scripts that spam fake stars and follows (will get your account banned), or
- Documentation that says "go participate in open source" and stops there.

GitHub Active is the small overlap: the achievements that GitHub awards purely for *your own* repo activity get a real, transparent runner. The achievements that genuinely need other humans get a clear explanation and a link to the legitimate way to earn them.

No fake stars. No spam PRs in repos you don&apos;t own. No daemon polling your account. Just one click → real PRs → real merges → real badges, contained in a repo you can delete at any time.

## License

[BSD 3-Clause](./LICENSE) — built by [Kerim-Sabic](https://github.com/Kerim-Sabic).

If you fork or substantially redistribute, please keep the attribution intact.
