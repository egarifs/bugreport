# Contributing

Thanks for helping. Read [AGENTS.md](AGENTS.md) first: it holds the mandatory rules (SOLID, tests, migrations, authorization).

## Setup

```bash
cp .env.example .env        # fill every placeholder; never commit .env
docker compose up -d        # PostgreSQL (needs POSTGRES_PASSWORD in your env)
npm ci
npx prisma migrate deploy
npm run seed:test           # optional demo data
npm run dev -- -p 3001
```

## Before opening a PR

```bash
npm run typecheck
npm test
npm run test:unit
npm run lint
npm run build
```

## Rules

- One focused change per PR; keep the diff small.
- Schema change = named Prisma migration (`npx prisma migrate dev --name <name>`), never `db push`.
- Authorization is enforced on the server, not only in the UI.
- Non-trivial logic ships with a runnable test.
- No real emails, secrets, or API keys in code, fixtures, or docs. Use `example.test` / `example.com`.

By contributing you agree your work is licensed under the [MIT License](LICENSE).
