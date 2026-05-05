# Contributing

Thanks for improving GitHub Active.

## Development

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm run typecheck
npm run test
npm run build
npm audit
```

## Standards

- Keep automation transparent and user-owned.
- Prefer GitHub App auth over PAT storage.
- Keep route handlers thin and move domain behavior into `src/server`.
- Add tests for scheduler, auth, setup, and policy changes.
- Avoid changes that enable fake achievements, spam, or deceptive contribution claims.

## Pull Requests

Include:

- What changed.
- Why it changed.
- How it was verified.
- Any deployment or environment implications.
