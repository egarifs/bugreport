# PRD-02B — Business Docs & Test Cases (MVP)

Status: **Draft**
Phase: 2B (setelah PRD-02 vendor workflow stabil)
Depends on: PRD-02 Done

## Problem

QA menulis test case di Google Sheet dari PRD hasil generate AI. Saat test gagal, QA harus menyalin manual title, steps, expected, actual ke bug report. Tidak ada riwayat hasil test per build/release, dan dokumen bisnis tidak terhubung ke bug.

## Goal

- Upload dokumen bisnis (PDF/MD) per project dengan riwayat versi.
- Import test case dari CSV hasil export Google Sheet.
- Catat test run (Pass / Fail / Blocked / Not Run).
- Satu tombol pada test case yang Fail: **"Create Bug Draft"**, yang otomatis mengisi title, steps, expected, actual, link test case, dan versi dokumen.

## Non-goals

- Generate test case langsung dari dokumen di dalam app (ditunda ke Phase 6).
- Integrasi langsung ke Google Drive API / Google Sheets API (MVP pakai export CSV manual).
- Test runner otomatis / eksekusi kode otomatis (Phase 7).

## User stories

1. Sebagai QA/Admin, saya upload dokumen bisnis (PDF/MD). Setiap upload baru dengan nama yang sama membuat versi baru (`v1`, `v2`, ...).
2. Sebagai member (QA, Developer, Vendor, Client), saya bisa membaca dokumen bisnis versi aktif dan melihat arsip versi lama.
3. Sebagai QA, saya import test case dari file CSV. Kolom yang didukung: ID/Code, Title, Precondition, Steps, Expected Result, Component, Priority.
4. Sebagai QA, saya membuat Test Run untuk suatu environment/build (misal: "Release v1.4 - Staging").
5. Sebagai tester, saya menandai hasil per test case: `Pass`, `Fail`, `Blocked`, `Not Run`, beserta catatan actual result.
6. Sebagai tester, ketika status diubah ke `Fail`, saya klik "Create Bug Draft" dan halaman create bug terbuka dengan field yang sudah terisi otomatis dari test case.
7. Sebagai user, di halaman detail bug saya bisa melihat asal test case dan versi dokumen yang dirujuk.

## Scope

### 1. Business documents

- Model: `business_docs (id, project_id, title, slug, created_by, created_at)`
- Model: `business_doc_versions (id, doc_id, version_num, file_path, file_name, file_size, mime_type, uploaded_by, uploaded_at, is_current)`
- Model: `business_doc_chunks (id, version_id, chunk_index, content, tsv)` — diproses saat upload untuk pencarian teks di Phase 4.
- Max file: 20 MB (PDF, Markdown).
- Semua member project punya akses baca (`doc.read`).
- Upload versi baru butuh `doc.manage` (Admin, QA).

### 2. Test cases

- Model: `test_cases (id, project_id, doc_version_id, code, title, precondition, expected_result, component, priority, created_by, updated_at)`
- Model: `test_case_steps (id, test_case_id, step_num, action, expected)`
- Import CSV: mapping kolom fleksibel, validasi duplikasi code per project.
- Export CSV.

### 3. Test run & bridge to bug

- Model: `test_runs (id, project_id, name, environment, build_version, status, started_at, completed_at, created_by)`
- Model: `test_run_items (id, test_run_id, test_case_id, status, actual_result, notes, executed_by, executed_at, created_bug_id)`
  - Status item: `not_run`, `pass`, `fail`, `blocked`
- Endpoint `POST /api/projects/[key]/test-runs/[runId]/items/[itemId]/create-bug`:
  - Membuat bug dengan status `Draft`
  - Menyalin:
    - `title`: `[Fail] <test_case.title>`
    - `steps`: gabungan `test_case_steps`
    - `expected`: `test_case.expected_result`
    - `actual`: `test_run_items.actual_result`
    - `environment`: `test_runs.environment`
    - `build`: `test_runs.build_version`
    - `test_case_id`, `test_run_id`, `doc_version_id`
  - Mengupdate `test_run_items.created_bug_id`
  - Membuat audit log

## Acceptance criteria

- [ ] Upload file > 20 MB atau format non-PDF/MD ditolak dengan pesan jelas.
- [ ] Upload file baru dengan slug sama otomatis menambah `version_num`, versi lama tidak terhapus.
- [ ] CSV import 500 baris selesai < 5 detik.
- [ ] Klik "Create Bug Draft" menghasilkan bug Draft dengan relasi terhubung; duplikasi klik tidak membuat bug ganda (idempotent).
- [ ] Vendor tidak bisa mengedit test case (`testcase.manage` ditolak), tetapi bisa mengeksekusi test run jika di-assign.

## Gate

- [ ] Test upload versi dokumen & immutability versi lama.
- [ ] Test import CSV dengan variasi format separator (koma, titik koma).
- [ ] E2E: Import test case → create run → set fail → click create bug → bug draft tersimpan dengan relasi utuh.
- [ ] Tidak ada bug P0/P1 terbuka.

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-23 | Draft | - | - | PRD dibuat dari hasil wawancara grill-me |
