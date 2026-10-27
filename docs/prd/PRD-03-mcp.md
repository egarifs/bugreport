# PRD-03 — MCP for AI Agents

Status: **Done**
Phase: 3
Depends on: PRD-02 Done

## User stories

1. Sebagai QA, saya membuat API key per project untuk AI agent.
2. Sebagai AI agent, saya membuat bug Draft lewat MCP saat testing menemukan masalah.
3. Sebagai AI agent, saya mencari bug existing sebelum melapor agar tidak duplicate.
4. Sebagai QA, saya melihat bug mana yang dibuat agent beserta run ID-nya.

## Scope

Endpoint: `POST /api/mcp` (Streamable HTTP), auth `Authorization: Bearer <api_key>`.

Tools:

| Tool | Scope |
|---|---|
| `search_bugs` | bug:read |
| `get_bug` | bug:read |
| `create_bug_draft` | bug:create |
| `add_bug_comment` | bug:comment |
| `attach_bug_screenshot` | bug:attach (base64, aturan upload sama dengan PRD-01) |

- API key: disimpan sebagai hash (SHA-256), ditampilkan sekali, terikat 1 project + scope, bisa revoke
- `create_bug_draft` selalu status Draft; server set reporter, project, timestamps
- `create_bug_draft` menjalankan duplicate check; jika similarity ≥ 0.6 kembalikan kandidat dan jangan buat bug kecuali `force: true`
- `agent_runs`: agent_name, model, run_id, created bug IDs
- Rate limit: 30 call/menit per key (tabel counter Postgres)

## Acceptance criteria

- [x] Key project A tidak bisa membaca/menulis project B
- [x] Input `status: "Open"` dari agent diabaikan, hasil tetap Draft
- [x] Key revoked balas 401
- [x] Panggilan ke-31 dalam 1 menit balas error rate limit
- [x] Semua tool call tercatat di audit log dengan `actor_type = agent`
- [x] Secret di input agent di-redact
- [x] Swagger UI & OpenAPI 3.0 collection tersedia di `/api-docs` & `/api/docs/openapi.json`

## Gate

- [x] Test dengan MCP JSON-RPC protocol (`initialize`, `tools/list`, `tools/call`)
- [x] Test authz, SHA-256 API key, duplicate check (>=60%), redaction, dan rate limit
- [x] Tidak ada bug P0/P1 terbuka (34 tests pass)

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-22 | Draft | - | - | PRD dibuat |
| 2026-10-26 | Done | `mcp.test.ts` (6 tests), 34/34 tests pass, Swagger UI di `/api-docs` | None | Selesai implementasi endpoint MCP Streamable HTTP, API key generator & rate limiting, duplicate threshold check, audit log agent, dan Swagger OpenAPI |
