# Bug Report by egarifs

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Collaborative bug tracking and QA test runs, with AI-agent support (MCP server and CLI).

- Bug lifecycle, verification, and release readiness
- Test cases and test runs with attempts, evidence, and re-run tracking
- Agent QA: MCP tools and the `@egarifs/bugreport` CLI (claim items, heartbeat, record results, import JUnit XML)
- Role-based access per project (Admin, QA, Developer, Vendor, Client)

## Quick start

Requirements: Node.js 20+, Docker (PostgreSQL).

```bash
cp .env.example .env          # replace every placeholder
export POSTGRES_PASSWORD=<choose-a-password>
docker compose up -d
npm ci
npx prisma migrate deploy
npm run dev                   # http://localhost:3001
```

Set `ENABLE_DEV_LOGIN="true"` only locally to sign in without Google OAuth.

## Scripts

| Command | Purpose |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm test` | Node tests (`src/lib/*.test.ts`, CLI) |
| `npm run test:unit` | Vitest (database-backed) |
| `npm run test:e2e` | Playwright |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Docs

- [Handover & team guide](docs/HANDOVER.md)
- [PRD](docs/prd/README.md)
- [Revamp roadmap](docs/revamp/ROADMAP.md)
- [Agent QA runner](docs/revamp/agent/bugboard-qa-runner.md)
- API docs: `/api-docs` (Swagger) when running

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © egarifs
