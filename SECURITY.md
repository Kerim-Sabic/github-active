# Security Policy

## Supported Versions

Security fixes target the current `main` branch.

## Reporting A Vulnerability

Please do not open public issues for secrets, token exposure, or authentication bypasses.

Email the maintainer or open a private GitHub security advisory when available. Include:

- Impacted route or module.
- Reproduction steps.
- Expected vs actual behavior.
- Whether any token, secret, or user data was exposed.

## Token Handling

- Production auth uses GitHub App installation tokens.
- Installation tokens are minted server-side and are not exposed to browsers.
- Manual mode validates PATs once and does not store them.
- Never commit `.env`, private keys, database URLs, or personal tokens.
