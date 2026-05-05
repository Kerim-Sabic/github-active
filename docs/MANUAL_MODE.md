# Manual Mode

Manual mode is a fallback for users who cannot configure the GitHub App immediately.

It validates a GitHub fine-grained personal access token once, lists recent repositories, and reports whether the token appears to have write access. The token is not stored by GitHub Active.

## Recommended Token Setup

1. Open GitHub personal access tokens:
   `https://github.com/settings/personal-access-tokens/new`
2. Choose a short expiration.
3. Select only the repositories you want to test.
4. Grant:
   - `Contents: Read and write`
   - `Metadata: Read`
5. Paste it into `/manual`.
6. Rotate or revoke the token after testing.

## Why Manual Mode Is Not The Production Default

GitHub App installation tokens are short-lived and repository-scoped. A stored PAT would increase blast radius and make revocation less ergonomic. Production 24/7 automation should use the GitHub App path.
