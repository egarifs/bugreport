# PRD-03 — MCP for AI Agents

Status: **Draft**
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

- [ ] Key project A tidak bisa membaca/menulis project B
- [ ] Input `status: "Open"` dari agent diabaikan, hasil tetap Draft
- [ ] Key revoked balas 401
- [ ] Panggilan ke-31 dalam 1 menit balas error rate limit
- [ ] Semua tool call tercatat di audit log dengan `actor_type = agent`
- [ ] Secret di input agent di-redact

## Gate

- [ ] Test dengan MCP client nyata (Claude Code / MCP Inspector)
- [ ] Test authz dan rate limit
- [ ] Tidak ada bug P0/P1 terbuka

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-22 | Draft | - | - | PRD dibuat |
