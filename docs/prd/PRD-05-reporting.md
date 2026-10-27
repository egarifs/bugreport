# PRD-05 — Reporting & Release Readiness

Status: **Done**
Phase: 5
Depends on: PRD-04 Done

## User stories

1. Sebagai CEO, saya melihat ringkasan kesehatan project dalam satu halaman.
2. Sebagai QA lead, saya melihat Draft yang terlalu lama belum direview.
3. Sebagai PM, saya export daftar bug ke CSV.

## Scope

- Dashboard per project: open by severity, by status, reopened, Draft aging, workload per assignee
- Release readiness: indikator `Not ready` jika ada Blocker/High belum Closed untuk version target
- Export CSV, menghormati permission
- ~~Notifikasi in-app untuk assignment dan status change~~ ditunda post-MVP (tidak ada acceptance criteria; tambah saat tim minta)

## Acceptance criteria

- [x] Angka dashboard sama dengan hasil query manual
- [x] Export oleh Vendor/Client tidak memuat internal note (export tidak menyertakan komentar sama sekali)
- [x] Dashboard load < 1 dtk untuk 10.000 bug (terukur 93 ms)

## Gate

- [x] Test angka metric vs data fixture (`report.test.ts`)
- [x] Tidak ada bug P0/P1 terbuka (44/44 tests pass)

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-22 | Draft | - | - | PRD dibuat |
| 2026-10-26 | Done | `report.test.ts` (3 tests), 44/44 pass, perf 10k bug 93 ms | None | `/projects/[key]/reports`, `/api/projects/[key]/export`, CSV formula-injection guard. Notifikasi in-app ditunda |
