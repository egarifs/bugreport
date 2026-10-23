# PRD-05 — Reporting & Release Readiness

Status: **Draft**
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
- Notifikasi in-app untuk assignment dan status change (email ditunda)

## Acceptance criteria

- [ ] Angka dashboard sama dengan hasil query manual
- [ ] Export oleh Vendor/Client tidak memuat internal note
- [ ] Dashboard load < 1 dtk untuk 10.000 bug

## Gate

- [ ] Test angka metric vs data fixture
- [ ] Tidak ada bug P0/P1 terbuka

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-22 | Draft | - | - | PRD dibuat |
