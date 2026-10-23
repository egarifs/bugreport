# PRD-00 — Product & Security Baseline

Status: **Draft**
Phase: 0
Owner: egarifs

## Problem

Bug tim tersebar di catatan masing-masing. Tidak ada source of truth, tidak ada tracking status, vendor dan QA tidak punya tempat kolaborasi.

## Goal

Satu aplikasi bug tracker untuk banyak project, dipakai QA, developer, vendor, CEO, dan client, dengan AI agent yang bisa melapor bug sebagai Draft.

## Non-goals (MVP)

- Test case management, test runner
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
- Upload: PNG/JPEG/WebP, ≤ 5 MB, ≤ 5 per bug, cek magic bytes, nama file di-generate server
- Audit log append-only untuk semua perubahan bug, user, member
- Redaction pola secret (`Bearer`, `api_key=`, `password=`, `Cookie:`) di text field sebelum simpan

## Data model

`users, projects, project_members, bugs, bug_comments, bug_attachments, audit_logs, api_keys, agent_runs, chat_threads, chat_messages`

Labels ditunda; pakai `component` text dulu.

## Gate

- [ ] Permission matrix disetujui
- [ ] Transition map disetujui
- [ ] Threat model ditinjau (auth bypass, IDOR antar project, upload, prompt injection)

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-22 | Draft | - | - | PRD dibuat |
