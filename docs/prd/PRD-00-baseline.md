# PRD-00 — Product & Security Baseline

Status: **Approved**
Phase: 0
Owner: egarifs

## Problem

Bug tim tersebar di catatan masing-masing. Tidak ada source of truth, tidak ada tracking status, vendor dan QA tidak punya tempat kolaborasi. Dokumen bisnis (PRD) dan test case terpisah di Google Sheets tanpa keterlacakan ke bug.

## Goal

Satu aplikasi bug tracker untuk banyak project, dipakai QA, developer, vendor, CEO, dan client, dengan:
- AI agent yang bisa melapor bug sebagai Draft
- Dokumen bisnis terversi per project
- Test case terstruktur yang di-import dari CSV
- Test run yang otomatis membuat bug Draft dari step gagal
- AI chat berbasis bug dan dokumen bisnis

## Non-goals (MVP)

- Test runner otomatis (arbitrary code execution)
- Generator test case via AI di dalam app (ditunda ke Phase 6; MVP pakai import CSV)
- Replace Jira untuk project management umum
- Vector DB, Redis, queue, microservice
- i18n (UI English dulu)

## Stack

Next.js (App Router, TypeScript), PostgreSQL 16 + `pg_trgm`, Prisma, Auth.js (Google), Tailwind + shadcn/ui, Zod, `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, Vitest, Playwright, Docker Compose.

## Roles & permissions

Role = bundle permission. Server cek permission, bukan nama role.

| Permission | Admin | QA | Developer | Vendor | Client | Viewer |
|---|---|---|---|---|---|---|
| user.review | ✓ | | | | | |
| project.manage | ✓ | | | | | |
| project.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| bug.create | ✓ | ✓ | ✓ | ✓ | ✓ | |
| bug.review (Draft → Open) | ✓ | ✓ | | | | |
| bug.update | ✓ | ✓ | ✓ | ✓ | | |
| bug.close | ✓ | ✓ | | | | |
| bug.reopen | ✓ | ✓ | | | ✓ | |
| bug.comment | ✓ | ✓ | ✓ | ✓ | ✓ | |
| note.internal.read | ✓ | ✓ | ✓ | | | |
| doc.manage | ✓ | ✓ | | | | |
| doc.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| testcase.manage | ✓ | ✓ | | | | |
| testcase.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| testrun.execute | ✓ | ✓ | ✓ | | | |
| chat.ask | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Role diberikan per project (`project_members.role`). Admin global lewat `users.is_admin`.

## User states

`pending` → `active` | `rejected`; `active` ↔ `suspended`.

Email di env `ADMIN_EMAILS` otomatis `active` + admin. Lainnya `pending`.

## Bug status transitions

| From | To | Permission |
|---|---|---|
| Draft | Open, Invalid, Duplicate, Cannot Reproduce | bug.review |
| Open / Reopened | In Progress, Won't Fix | bug.update |
| In Progress | Ready for Verification | bug.update |
| Ready for Verification | Closed, In Progress | bug.close |
| Closed | Reopened | bug.reopen |

Transisi lain ditolak server (HTTP 409).

## Severity / Priority

Severity: Blocker, High, Medium, Low. Priority: Urgent, High, Normal, Low. Definisi di roadmap.

## Security baseline

- Authorization di setiap query lewat `project_members`
- Secret hanya di env server, tidak pernah ke client bundle atau log
- Upload:
  - Screenshot: PNG/JPEG/WebP, ≤ 5 MB, ≤ 5 per bug
  - Dokumen bisnis: PDF/MD, ≤ 20 MB per file
  - Cek magic bytes, nama file di-generate server, disk volume
- Audit log append-only untuk semua perubahan bug, user, member, dokumen, testrun
- Redaction pola secret (`Bearer`, `api_key=`, `password=`, `Cookie:`) di text field sebelum simpan
- AI input defense: dokumen bisnis dan teks bug diperlakukan sebagai data mentah, bukan instruksi sistem

## Data model

`users, projects, project_members, bugs, bug_comments, bug_attachments, business_docs, business_doc_versions, business_doc_chunks, test_cases, test_case_steps, test_runs, test_run_items, audit_logs, api_keys, agent_runs, chat_threads, chat_messages`

## Gate

- [x] Permission matrix disetujui (termasuk doc.* dan testcase.*)
- [x] Transition map disetujui
- [x] Threat model ditinjau (auth bypass, IDOR antar project, upload, prompt injection)

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-22 | Draft | - | - | PRD dibuat |
| 2026-10-23 | Approved | Wawancara grill-me selesai | - | Tambah permissions doc/testcase; approved user |
