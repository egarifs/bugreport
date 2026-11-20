# Coding Rules

All agents and contributors must follow these rules.

## SOLID

- **Single Responsibility:** one module owns one business responsibility. Keep route handlers thin; move validation and business logic into services.
- **Open/Closed:** add behavior through registries, maps, or new services. Do not grow central `switch` or conditional chains when a registry fits.
- **Liskov Substitution:** implementations must honor existing contracts, return shapes, validation, and error semantics.
- **Interface Segregation:** keep input types and service contracts narrow. Do not pass broad objects when function needs a few fields.
- **Dependency Inversion:** isolate Prisma, filesystem, network, and framework dependencies behind service boundaries where practical. Do not add abstractions with one trivial use.

## Delivery

- Read relevant acceptance criteria before coding.
- Server-side authorization and trust-boundary validation required.
- Schema changes require named Prisma migration.
- Add one runnable test for non-trivial logic.
- Prefer deletion and native platform features over new dependencies.
- Never read, print, or commit `.env`.
- Preserve unrelated local changes.
- Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` before report.
