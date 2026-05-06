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

## What it does

- **Achievement Lab** — one-click runners for **Pull Shark**, **YOLO**, **Quickdraw**, and **Pair Extraordinaire**. Real branches, real PRs, real merges. All confined to a `github-active-sandbox` repo so your real projects stay clean. Tier-aware: shows your current count, the next tier (1 / 2 / 16 / 128 / 1024), and progress in real time.
- **Pair Board (`/coop`)** — opt-in queue. The next signed-in user to join becomes your co-author. One click runs a mutual co-authored commit; both sides earn Pair Extraordinaire from the same commit.
- **Showcase (`/showcase`)** — discover what other lab users are building. Each card has a "View on GitHub" link — star what you actually like. Featured-by-the-maker pin at the top for `Kerim-Sabic/github-active`.
- **Pair invite link** — generate a `?pair=YOU` URL that pre-fills the partner field for whoever opens it. Shareable on Discord/Twitter.
- **Honest social section** — Galaxy Brain, Starstruck, Heart-on-Sleeve, and Public Sponsor *can&apos;t* be automated. The lab says so out loud and links you to the legitimate path for each.
- **Profile polish** — opt-in `username/username` README writer for when you want a clean, structured profile landing page.

### Reliability

Every Pull Shark / YOLO run is hardened:

- Re-fetches the default branch tip after each merge so a 16-PR run never branches from a stale ancestor.
- Random 6-char suffix on every branch / file / PR title — re-runs after a partial failure can never collide.
- Auto-retries on GitHub rate-limit (`403`) and transient `5xx` with exponential backoff, honoring `Retry-After`.
- "Reference already exists" errors regenerate the branch name and retry once.
- `GET /api/achievements/status` queries your sandbox directly for verification — refresh the lab to see exactly which tiers GitHub already credits you for.

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

# 2. fill four env vars (lab-only)
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#   APP_URL=http://localhost:3000
#   SESSION_SECRET (32+ chars)

# 3. (optional) wire Postgres for the Pair Board + Showcase
#    Get the URI from Supabase → Settings → Database → Connection string.
#    Add to .env.local:
#      SUPABASE_DATABASE_URL=postgres://...
#    Then run:
#      psql "$SUPABASE_DATABASE_URL" -f drizzle/0000_initial.sql
#      psql "$SUPABASE_DATABASE_URL" -f drizzle/0001_coop.sql

# 4. install + run
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
| GitHub API | Raw `fetch` + Zod schemas with retry-with-backoff — no Octokit, no abstraction debt |
| Persistence | Drizzle ORM on Postgres (Netlify DB / Supabase / self-hosted) |
| Realtime | Supabase Realtime (`postgres_changes`) for the Pair Board match notifications |
| Streaming | Server-Sent Events for live run consoles |
| Tests | Vitest |

## Project structure

```
src/
├── app/
│   ├── achievements/             # /achievements — Lab page + client + README form + supporter modal
│   ├── coop/                     # /coop — Pair Board page + realtime client
│   ├── showcase/                 # /showcase — community grid + featured pin
│   ├── api/
│   │   ├── achievements/{run,status,profile-readme}/
│   │   ├── coop/{join,leave,status,run}/
│   │   ├── showcase/{add,list,remove,my-repos}/
│   │   ├── supporter/{click,skip,status}/
│   │   ├── supabase/{github,callback,sign-out}/
│   │   └── github/{install,login,callback}/
│   ├── connect/, dashboard/, manual/, setup/
│   ├── layout.tsx                # Mounts the contribution-grid backdrop globally
│   └── page.tsx                  # Landing
├── server/
│   ├── auth/
│   │   ├── provider-token.ts     # Reads Supabase provider_token server-side
│   │   └── supabase-session.ts
│   ├── db/
│   │   ├── client.ts             # getDatabase() — null-safe Drizzle client
│   │   ├── schema.ts             # users · pair_signups · repo_showcase · automation_*
│   │   ├── user-repo.ts          # ensureUserFromProvider()
│   │   ├── pair-repo.ts          # join / leave / match queue helpers
│   │   └── showcase-repo.ts      # add / list / remove showcase entries
│   ├── github/
│   │   ├── client.ts             # OAuth + Contents API + headers helper
│   │   ├── mutations.ts          # retry-with-backoff PR / issue / merge primitives
│   │   ├── sandbox.ts            # ensureSandboxRepo()
│   │   └── star-check.ts         # GET /user/starred/{owner}/{repo}
│   └── featured-repos.ts         # Static "Featured by the maker" pins
├── shared/
│   ├── achievement-goals.ts      # Single source of truth for the 10 goals
│   └── ui/                       # button · card · input · badge · activity-backdrop
└── utils/supabase/{server,client,middleware}.ts

drizzle/
├── 0000_initial.sql              # users / installations / schedules / job_runs / audit
└── 0001_coop.sql                 # pair_signups · repo_showcase · users.starred_at columns
```

## Verification

```bash
npm run typecheck   # strict TS
npm run test        # vitest
npm run build       # next build (Turbopack)
```

End-to-end manual check:

1. `npm run dev`, sign in with GitHub.
2. `/achievements` → click **+2** on Pull Shark.
3. SSE log streams: branch → commit → PR opened → merged. Twice.
4. Progress bar updates: 2/16 toward Gold tier.
5. Visit `https://github.com/<your-login>/github-active-sandbox/pulls?q=is:merged`.
6. Wait ~15 minutes, check `https://github.com/<your-login>?tab=achievements`.

End-to-end Pair Board check (needs `SUPABASE_DATABASE_URL` set):

1. Sign in as user A in browser 1, click **Join the pair queue** on `/coop`.
2. Sign in as user B in browser 2, also `/coop`, click **Join**.
3. Both pages flip to **Matched** without refresh (Supabase Realtime).
4. Either user clicks **Run pair commit**. Co-authored commit lands in that user's sandbox.
5. Both accounts get credited Pair Extraordinaire within ~15 minutes.

## Why this exists

Most "GitHub achievement bot" projects are either:

- Vanity scripts that spam fake stars and follows (will get your account banned), or
- Documentation that says "go participate in open source" and stops there.

GitHub Active is the small overlap: the achievements that GitHub awards purely for *your own* repo activity get a real, transparent runner. The achievements that genuinely need other humans get a clear explanation, the Pair Board for the ones two opt-in users can solve mutually, and a Showcase board for organic discovery — but never automated coordinated-engagement.

No fake stars, no automated star trading, no token-driven actions on the user&apos;s behalf without their explicit click. Just one click → real PRs → real merges → real badges, contained in a repo you can delete at any time. The Pair Board makes Pair Extraordinaire mutual. The Showcase makes new projects discoverable. That&apos;s the whole product.

## License

[BSD 3-Clause](./LICENSE) — built by [Kerim-Sabic](https://github.com/Kerim-Sabic).

If you fork or substantially redistribute, please keep the attribution intact.
