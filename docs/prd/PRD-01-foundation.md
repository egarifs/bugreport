# PRD-01 — Foundation: Auth, Approval, Project, Bug CRUD

Status: **Draft**
Phase: 1
Depends on: PRD-00 Done

## User stories

1. Sebagai user baru, saya login dengan Google dan melihat halaman "Admin sedang mereview akses Anda" sampai disetujui.
2. Sebagai Admin, saya melihat daftar user pending lalu approve/reject, dan assign project + role.
3. Sebagai Admin, saya membuat project dan mengelola member.
4. Sebagai QA, saya membuat bug dengan field wajib dan screenshot.
5. Sebagai member, saya hanya melihat bug dari project saya.
6. Sebagai QA, saya mengubah status bug sesuai transition map.
7. Sebagai member, saya berkomentar di bug.
8. Sebagai Admin, saya melihat audit log.

## Scope

- Google OAuth (Auth.js), session DB
- `/pending` page: email, tanggal request, status, tombol sign out. Tidak ada data project.
- `/admin/users`: approve, reject, suspend
- `/projects`, `/projects/[key]/settings/members`
- Bug list: filter status, severity, assignee, search title/ID
- Bug create/detail/edit
- Bug ID per project: `{PROJECT_KEY}-{n}`, contoh `CRM-12`
- Comments
- Screenshot upload (disk volume)
- Audit log

## Bug fields

Wajib: title, description, steps, expected, actual, severity, environment.
Opsional: priority, assignee, component, app version, build, browser/device.

## Acceptance criteria

- [ ] User baru non-admin setelah login ke `/pending`; semua route lain redirect ke `/pending`
- [ ] API dengan session `pending` balas 403
- [ ] Email di `ADMIN_EMAILS` langsung active admin
- [ ] User A tidak bisa GET/PATCH bug project B lewat ID langsung (403/404)
- [ ] Transisi ilegal balas 409 dan tidak mengubah data
- [ ] Upload > 5 MB, tipe selain PNG/JPEG/WebP, atau file 6 ditolak
- [ ] Setiap create/update bug, status change, approve user tercatat di audit log
- [ ] Field berisi `Bearer xxx` tersimpan sebagai `Bearer [REDACTED]`

## Gate

- [ ] `npm run lint && npm run typecheck && npm test` pass
- [ ] Playwright: login pending flow, create bug, status flow, cross-project access
- [ ] Tidak ada bug P0/P1 terbuka

## Execution log

| Date | Status | Evidence | Blocking bugs | Notes |
|---|---|---|---|---|
| 2026-10-22 | Draft | - | - | PRD dibuat |
