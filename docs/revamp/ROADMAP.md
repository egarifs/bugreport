# Roadmap implementasi revamp BugBoard

Keputusan 3 Nov 2026 (review QA lead): **MVP = inti QA dulu**. Fitur lain menunggu MVP dipakai tim minimal satu sprint.

Setiap item merujuk tugas (T…) atau fitur (F…) di `README.md` dan kriteria terima di `acceptance/`. Semua data contoh mengikuti `dataset.md`.

## Ringkasan fase

| Fase | Isi | Kriteria terima | Syarat mulai |
|---|---|---|---|
| **MVP · Inti QA** | Navigasi, kamus status + hak akses, siklus bug v3, preferensi notifikasi, test run standar QA (F8), agent QA lokal (F9) | `acceptance/01`–`04` | Fondasi tema (sudah ada) |
| Fase 2 · Sprint & laporan | F1 Sprint, F3/F4 dipakai di Sprint, F5 Tren, F12 Ringkasan grafik, Kesiapan rilis v3 tanpa panel kriteria keluar | ditulis saat fase dimulai | MVP dipakai 1 sprint |
| Fase 3 · Dokumen & STLC | F2 Dokumen bisnis (Word/PDF/Notion), F14 DoR, Test Plan, RTM, Test Summary, DoD, Release notes; panel kriteria keluar di `G4` | ditulis saat fase dimulai | Fase 2 |
| Fase 4 · Orang & luar | F11 Performa, F10 Onboarding + sandbox, F6 Portal klien, sisa F7 (impor, API docs) | ditulis saat fase dimulai | Fase 3 (Performa butuh data sprint; Sandbox butuh `dataset.md`) |

## MVP: urutan kerja

Kerjakan berurutan; satu baris = satu PR. Kolom "Skema" menyebut perubahan Prisma yang dibutuhkan.

| # | Pekerjaan | Mockup | Skema | Bergantung pada |
|---|---|---|---|---|
| 0 | Setup test: Playwright + Vitest, seed `dataset.json` sebagai project `isTest` | — | `Project.isTest` | — |
| 1 | Shell + navigasi rail/☰ (T1, F13) | `D1`–`D3` | — | 0 |
| 2 | Kamus status jadi satu sumber: label internal, label portal, glyph, siapa yang memindahkan. Matriks hak akses diperiksa ulang di server | `G6` | — (kode: `src/lib/status-dictionary.ts` baru, `permissions.ts`) | 1 |
| 3 | Pola state kosong/memuat/error/akses/data banyak sebagai komponen bersama | `G7` | — | 1 |
| 4 | Daftar bug + triase (T2) | `10`, `11` | — | 2, 3 |
| 5 | Laporkan bug v3: cek duplikat inline + panduan severity × prioritas (T4) | `G3` | — | 2 |
| 6 | Detail bug v3: banner verifikasi di build, field Sprint/Tenggat/Ditemukan/Diperbaiki, Requirement, Test case Perlu re-run (T3, F3, F4) | `G1` | `Bug.fixedInVersion`, `Bug.fixedInBuild`, `Bug.dueAt`, `Bug.verifiedAt`, `Bug.verifiedInBuild`. `buildNumber`/`appVersion` yang ada = "Ditemukan di" | 2 |
| 7 | Gabungkan duplikat + urungkan 10 menit | `G2` | Tabel `BugCoReporter` (bugId, userId, sourceBugId). `duplicateOfId` sudah ada | 6 |
| 8 | Preferensi notifikasi + ringkasan harian/per sesi + mode fokus | `G5` | `NotificationPreference` (userId, projectId?, type, mode `IMMEDIATE·DAILY·PER_SESSION·OFF`), `User.focusUntil`, `Notification.sessionId?`. Tipe notifikasi baru: `rerun`, `agent_session`, `doc_approval`, `mention` | 6 |
| 9 | Test case: halaman tambah/ubah, versi, riwayat (F8) | `23`, `23a`, `23b` | `TestCaseVersion` (testCaseId, version, snapshot Json, createdById) | 2 |
| 10 | Test run: log percobaan, re-run, banyak bug per item, tutup run (F8) | `24a`, `24b` | `TestRunAttempt` (itemId, no, result, actualResult, failedStep, build, environment, executedById, viaAgent, sessionId?, createdAt); `TestRunItem.needsRerun`, `TestRunItem.caseVersion`; enum `TestRunItemStatus` + `SKIPPED`; join `TestRunItemBug` menggantikan `Bug.testRunItemId @unique` (migrasi data: salin relasi lama ke join) | 9 |
| 11 | Retest dari detail bug: "Lolos verifikasi" menawarkan percobaan re-run pada item tertaut | `G1` | — (pakai #10) | 6, 10 |
| 12 | Agent QA lokal: kunci preset, sumber akun uji (link), Siap untuk agent, MCP tools + CLI, sesi, lease + heartbeat, indikator berjalan (F9) | `90`–`95` | perluas `AgentRun` jadi sesi (`status`, `toolName`, `workdir`, `startedAt`, `finishedAt`, `summary Json`, `userId`), `TestRunItem.leasedById`, `leaseExpiresAt`, `heartbeatAt`, `currentStep`; `TestResourceLink` (projectId, label, url, environment, visibility, ownerId, lastStatus); `TestCase.agentReady`, `TestCase.testData Json`; `Evidence` (attemptId, kind, storedName/url, fileSize; disk server, ≤ 20 MB, lebih besar = link). CLI di `packages/cli`. Indikator berjalan = polling 5 detik | 10 |

### Catatan migrasi

- Repo sudah memakai Prisma Migrate (`prisma/migrations/20261026075205_init`). Setiap baris MVP yang mengubah skema = satu migrasi bernama, mis. `npx prisma migrate dev --name bug_fixed_in_build`. Jangan memakai `db push` di cabang fitur.
- Migrasi #10 paling berisiko (mengubah relasi bug ↔ item). Urutan aman: buat tabel join → salin data dari `Bug.testRunItemId` → ubah kode baca/tulis ke join → hapus kolom lama di migrasi berikutnya.
- `SKIPPED` ditambahkan ke enum; laporan lama yang menghitung `NOT_RUN` tidak berubah.
- Route MCP (`src/app/api/mcp/route.ts`) perlu menjawab `notifications/initialized` dan `ping` sebelum dipakai agent pi (#12).

## Yang sengaja ditunda

- Panel "Kriteria keluar · Test Plan" di Kesiapan rilis (`G4`) muncul setelah Test Plan ada (Fase 3). Di Fase 2, `G4` tampil tanpa panel itu.
- Onboarding (F10) memakai `dataset.md` sebagai seed sandbox; jangan membuat data dummy lain.
- Performa (F11) butuh minimal satu sprint data nyata agar angka bermakna.
