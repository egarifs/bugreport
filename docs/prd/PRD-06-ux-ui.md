# PRD-06 — UX/UI: tampilan per peran, laporan inspeksi, master modul

**Status:** In Progress (P0/P1 live di prod `77579df`; P2 + audit kontras tersisa)
**Sumber:** sesi grill-me Q1–Q5c, 2026-10-28.

## Tujuan
QA menyelesaikan triase dengan cepat di desktop. Vendor melihat tugasnya, termasuk dari HP. Severity terbaca sekilas. Modul diambil dari master list, tidak lagi teks bebas.

## Token
| Token | Nilai |
|---|---|
| Latar / teks / garis | `#F4F6F7` / `#15212B` / `#D3DAE0` (palet `slate` di-remap di `tailwind.config.js`) |
| Aksi | `action` `#1E5AA8`, hover `#174A8C` |
| Severity (teks/latar) | Blocker `#B42318/#FDECEA`, High `#B54708/#FEF0E6`, Medium `#8A6100/#FDF6DC`, Low `#3D5A80/#EAF0F7` |
| Font | Atkinson Hyperlegible 400/700 (`next/font`; varian *Next* belum ada di Next 15.2.1), angka tabular |
| Ukuran minimum | 13px (`text-xs`). Tidak ada `text-[10/11px]`. |
| Fokus | `:focus-visible` outline 2px warna aksi. Menghormati `prefers-reduced-motion`. |

Aturan: severity jadi satu-satunya warna mencolok, status netral. Strip severity 3px di kiri tiap baris. Tanpa emoji, panah, label uppercase, atau kartu metrik template.

## Peran
| Peran | Halaman pertama | Menu |
|---|---|---|
| QA/Admin | Perlu review (Draft) | Semua |
| Vendor/Dev | Tugas saya (severity, lalu umur) | Bug, Laporan, Test case, Dokumen, AI Chat |
| Client | Laporan | Bug, Laporan, Dokumen |
| Viewer | Semua bug (read-only) | Bug, Laporan, Dokumen |

Client dan Viewer kehilangan `chat.ask` dan `testcase.read`. Batasan ini ditegakkan server-side di halaman dan `/api/projects/[key]/chat`, bukan hanya dengan menyembunyikan menu.

## Modul
- Tabel `Module` (`projectId`, `name` unik per project, `sortOrder`, `archivedAt`). `Bug.moduleId` dan `TestCase.moduleId` ditambahkan; `component`/`moduleArea` disimpan sebagai legacy.
- Backfill: `deploy/backfill-modules.sql` (idempotent, case-insensitive).
- Hanya `project.manage` yang mengelola modul di Settings: tambah, rename, urutkan, arsipkan/aktifkan. Tidak ada hapus, supaya histori tetap utuh.
- Draft boleh tanpa modul. Perpindahan Draft ke Open wajib versi/build dan modul aktif.
- Form manual wajib memilih modul jika project sudah punya modul.
- MCP: tool `list_modules`. Untuk `component`, nama dicocokkan case-insensitive. Jika tidak cocok, modul dibiarkan kosong; tidak ada auto-create.
- Test run gagal mewarisi modul test case. Import menautkan modul yang cocok dan melaporkan nama modul yang tidak dikenal.

## Perbaikan per halaman
| Prio | Halaman | Item | Status |
|---|---|---|---|
| P0 | Daftar bug | Tab per peran, sort severity lalu umur, kolom Umur, baris modul/asal/komentar, strip severity, kartu di HP, empty state yang mengarahkan aksi | Selesai |
| P0 | Detail bug | Badge baru, pilih modul di gate Draft ke Open, error inline, tombol pending | Selesai |
| P0 | Shell | Layout HP (top bar di atas, sebelumnya di kiri), menu per permission, label Indonesia, badge fase dihapus | Selesai |
| P0 | Global | Token, font, `error.tsx` (digest, tanpa detail), `loading.tsx` | Selesai |
| P1 | Form bug baru | Select modul, error validasi inline, tombol pending | Selesai |
| P1 | Settings | Section Modul | Selesai |
| P1 | Test case | Kolom modul, hasil import inline | Selesai |
| P2 | Halaman lain (docs, chat, reports, admin, projects) | Migrasi ke `ActionForm`, header konsisten | Belum |
| P2 | Import test case | Preview sebelum commit | Ditunda (ponytail) |
| P2 | Notifikasi in-app | Fase berikut | Belum |

## Acceptance criteria
- [x] Tidak ada `text-[9-11px]`, `uppercase tracking`, emoji, atau `→` di `src/`.
- [x] Vendor membuka project dan langsung masuk ke "Tugas saya". QA/Admin masuk ke "Perlu review". Client diarahkan ke Laporan.
- [x] Client dan Viewer mendapat 403 di API chat, dan redirect saat membuka halaman chat/test case. Diuji di `permissions.test.ts`.
- [x] Draft ke Open tanpa modul ditolak dengan pesan inline.
- [x] `resolveModuleId` case-insensitive, tidak auto-create, mengabaikan modul diarsipkan, dan menolak modul project lain. `list_modules` juga diuji (`modules.test.ts`).
- [x] Layar 390px: top bar di atas, kartu bug 2 baris, tanpa scroll horizontal.
- [ ] Kontras WCAG AA diverifikasi alat (target: semua pasangan token ≥ 4.5:1).
- [x] Deploy prod + backfill modul di prod.

## Screenshot
`~/Pictures/Screenshots/prd06/{before,after}-{admin,vendor}-{list,detail,settings,new}-{d,m}.png`.

## Execution log
- 2026-10-28: schema `Module` + backfill lokal (12 modul). Token, font, shell, daftar/detail bug, settings modul, MCP `list_modules`, gating peran. Typecheck, lint, 56/56 test, dan build lolos.
- 2026-10-29: deploy `77579df`. Backup `db-20261029T020938Z.sql.gz` diambil sebelum deploy. `db push` OK, backfill membuat 1 modul dan menautkan 1 bug; 0 baris tersisa tanpa tautan. Container healthy, `/login` 200 (lokal + publik). Rollback ke `66dbde5`.
  Log berisi `TypeError: controller[kState].transformAlgorithm is not a function` (4x, tidak terkait request uji). Ini noise stream Node 22 + Next 15.2.1 saat client putus; dipantau, belum ditindak.
