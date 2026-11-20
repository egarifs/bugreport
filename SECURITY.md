# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's private reporting: **Security → Report a vulnerability** on this repository.
Include steps to reproduce, affected version or commit, and impact.

You can expect an acknowledgement within 7 days. Fixes are released as soon as practical, and reporters are credited unless they prefer otherwise.

## Scope

In scope: authentication, authorization (project/role isolation), API keys and MCP endpoint, file uploads and evidence handling, secret redaction.

## Deployment notes

- Never commit `.env`. Generate your own `AUTH_SECRET` (`openssl rand -base64 32`).
- Keep `ENABLE_DEV_LOGIN="false"` outside local development and tests.
- Rotate any API key that was exposed; revoked keys stop working immediately.
