# BugReport — PRD Index

Source roadmap: `/home/ea/obsidian vault/Central Bug Tracker - Roadmap.md`

## Status legend

| Status | Arti |
|---|---|
| Draft | PRD ditulis, belum disetujui |
| Approved | PRD disetujui, siap dikerjakan |
| In Progress | Sedang diimplementasikan |
| In QA | Implementasi selesai, sedang diuji gate |
| Done | Gate lulus, tidak ada bug P0/P1 terbuka |
| Blocked | Terhenti, alasan ditulis di PRD |

Aturan: PRD berikutnya hanya boleh `In Progress` jika PRD sebelumnya `Done`.

## PRD list

| ID | Judul | Phase | Status | Updated |
|---|---|---|---|---|
| [PRD-00](PRD-00-baseline.md) | Product & security baseline | 0 | Approved | 2026-10-23 |
| [PRD-01](PRD-01-foundation.md) | Foundation: auth, approval, project, bug CRUD | 1 | Approved | 2026-10-23 |
| [PRD-02](PRD-02-vendor-workflow.md) | Vendor workflow & bug quality | 2 | Draft | 2026-10-23 |
| [PRD-02B](PRD-02B-docs-and-testcases.md) | Business docs & test cases (MVP) | 2B | Draft | 2026-10-23 |
| [PRD-03](PRD-03-mcp.md) | MCP for AI agents | 3 | Draft | 2026-10-23 |
| [PRD-04](PRD-04-project-chat.md) | Project AI chat (bugs + docs) | 4 | Draft | 2026-10-23 |
| [PRD-05](PRD-05-reporting.md) | Reporting & release readiness | 5 | Draft | 2026-10-23 |
| PRD-06 | AI test case generator (from docs) | 6 | Not written | - |
| PRD-07 | Test runner & Grill Mode | 7 | Not written | - |

PRD-06 dan PRD-07 ditulis setelah PRD-05 `Done`.

## Status update template

Tambahkan di bagian `## Execution log` tiap PRD:

```text
| Date | Status | Evidence | Blocking bugs | Notes |
```

Evidence wajib: commit/PR, hasil test (`npm test`, Playwright), dan checklist gate.
