# Deployment

This project is designed for Netlify hosting with Netlify Database/Postgres and GitHub App authentication.

## Required Netlify Environment Variables

```env
APP_URL=https://githubactive.netlify.app
SESSION_SECRET=replace_with_at_least_32_random_characters
INTERNAL_JOB_SECRET=replace_with_at_least_16_random_characters
NETLIFY_DATABASE_URL=postgres_connection_string

GITHUB_APP_SLUG=your-github-app-slug
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_APP_CLIENT_SECRET=github_app_client_secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

## GitHub App Settings

- Homepage URL: `https://githubactive.netlify.app`
- Callback URL: `https://githubactive.netlify.app/api/github/callback`
- Setup URL: `https://githubactive.netlify.app/api/github/callback`
- Repository permissions: `Contents: Read and write`, `Metadata: Read`
- User authorization: enabled

## Database

Apply the initial schema:

```bash
psql "$NETLIFY_DATABASE_URL" -f drizzle/0000_initial.sql
```

## Smoke Test

1. Visit `https://githubactive.netlify.app/api/setup/status`.
2. Confirm all checks are configured.
3. Click `Connect GitHub`.
4. Install the GitHub App on a test repository.
5. Return to `/dashboard`.
6. Preview a commit.
7. Run one manual commit.
8. Confirm the scheduled dispatcher runs after the local device is off.

## Manual Fallback

`/manual` validates a fine-grained token once and does not save it. It is useful for diagnosing token permissions, not for production 24/7 automation.
