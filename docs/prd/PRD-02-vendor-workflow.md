# PRD-02 — Vendor Workflow & Bug Quality

Status: **Draft**
Phase: 2 (urgent: development dengan vendor sedang berjalan)
Depends on: PRD-01 Done

## User stories

1. Sebagai QA, saya assign bug ke developer vendor dan vendor melihatnya di "My bugs".
2. Sebagai vendor, saya hanya melihat project yang di-assign, dan tidak melihat internal note.
3. Sebagai QA, saya mereview Draft di "Review queue" lalu Open/Invalid/Duplicate/Cannot Reproduce.
4. Sebagai reporter, saya diperingatkan jika ada bug mirip sebelum submit.
5. Sebagai QA, saya reopen bug Closed dengan alasan, alih-alih membuat bug baru.
6. Sebagai vendor, saya set "Ready for Verification", lalu QA verify ke Closed atau balik ke In Progress.

## Scope

- Role Vendor + Client
- Comment type: `public` | `internal` (internal tersembunyi untuk Vendor/Client)
- Review queue: semua Draft per project, urut terlama
- Duplicate suggestion: `pg_trgm similarity(title) > 0.4` di bug aktif project sama, maksimal 5 hasil
- Reopen: status Reopened, alasan wajib, `reopen_count` +1
- Activity timeline di bug detail (dari audit log)
- Version/build wajib sebelum Draft → Open

## Acceptance criteria

- [ ] Vendor tidak menerima internal note di UI maupun response API
- [ ] Vendor tidak bisa Draft → Open
- [ ] Bug duplicate ditandai `Duplicate` dengan `duplicate_of_id` menunjuk bug valid di project sama
- [ ] Reopen tanpa alasan ditolak
- [ ] Draft → Open tanpa version/build ditolak dengan pesan jelas
- [ ] Duplicate suggestion muncul untuk title mirip dan tidak muncul untuk bug Closed/Invalid

## Gate

- [ ] Test isolasi vendor (API + UI)
- [ ] E2E: Draft → review → assign vendor → fix → verify → close → reopen
- [ ] Tidak ada bug P0/P1 terbuka

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-22 | Draft | - | - | PRD dibuat |
