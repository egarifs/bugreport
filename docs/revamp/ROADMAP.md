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

| # | Pekerjaan | Mockup | Skema | Status | Bergantung pada |
|---|---|---|---|---|---|
| 0 | Setup test: Playwright + Vitest, seed `dataset.json` sebagai project `isTest` | — | `Project.isTest` | Selesai | — |
| 1 | Shell + navigasi rail/☰ (T1, F13) | `D1`–`D3` | — | Selesai | 0 |
| 2 | Kamus status jadi satu sumber: label internal, label portal, glyph, siapa yang memindahkan. Matriks hak akses diperiksa ulang di server | `G6` | — (kode: `src/lib/status-dictionary.ts` baru, `permissions.ts`) | Selesai | 1 |
| 3 | Pola state kosong/memuat/error/akses/data banyak sebagai komponen bersama | `G7` | — | Selesai | 1 |
| 4 | Daftar bug + triase (T2) | `10`, `11` | — | Selesai | 2, 3 |
| 5 | Laporkan bug v3: cek duplikat inline + panduan severity × prioritas (T4) | `G3` | — | Selesai | 2 |
| 6 | Detail bug v3: banner verifikasi di build, field Sprint/Tenggat/Ditemukan/Diperbaiki, Requirement, Test case Perlu re-run (T3, F3, F4) | `G1` | `Bug.fixedInVersion`, `Bug.fixedInBuild`, `Bug.dueAt`, `Bug.verifiedAt`, `Bug.verifiedInBuild`. `buildNumber`/`appVersion` yang ada = "Ditemukan di" | Selesai | 2 |
| 7 | Gabungkan duplikat + urungkan 10 menit | `G2` | Tabel `BugCoReporter` (bugId, userId, sourceBugId). `duplicateOfId` sudah ada | Selesai | 6 |
| 8 | Preferensi notifikasi + ringkasan harian/per sesi + mode fokus (Selesai: PR #13) | `G5` | `NotificationPreference` (userId, projectId?, type, mode `IMMEDIATE·DAILY·PER_SESSION·OFF`), `User.focusUntil`, `Notification.sessionId?`. Tipe notifikasi baru: `rerun`, `agent_session`, `doc_approval`, `mention` | Selesai | 6 |
| 9 | Test case: repository, halaman tambah/ubah, versi, riwayat (F8) | `23`, `23a`, `23b` | `TestCaseVersion` (testCaseId, version, snapshot Json, createdById) | Selesai | 2 |
| 10 | Test run: log percobaan, re-run, banyak bug per item, tutup run (F8) | `24`, `24a`, `24b` | `TestRunAttempt` (itemId, no, result, actualResult, failedStep, build, environment, executedById, viaAgent, sessionId?, createdAt); `TestRunItem.needsRerun`, `TestRunItem.caseVersion`; enum `TestRunItemStatus` + `SKIPPED`; join `TestRunItemBug` menggantikan `Bug.testRunItemId @unique` (migrasi data: salin relasi lama ke join) | Selesai | 9 |
| 11 | Retest dari detail bug: "Lolos verifikasi" menawarkan percobaan re-run pada item tertaut | `G1` | — (pakai #10) | Selesai | 6, 10 |
| 12 | Agent QA lokal: kunci preset, sumber akun uji (link), Siap untuk agent, MCP tools + CLI, sesi, lease + heartbeat, indikator berjalan (F9) | `90`–`95` | perluas `AgentRun` jadi sesi (`status`, `toolName`, `workdir`, `startedAt`, `finishedAt`, `summary Json`, `userId`), `TestRunItem.leasedById`, `leaseExpiresAt`, `heartbeatAt`, `currentStep`; `TestResourceLink` (projectId, label, url, environment, visibility, ownerId, lastStatus); `TestCase.agentReady`, `TestCase.testData Json`; `Evidence` (attemptId, kind, storedName/url, fileSize; disk server, ≤ 20 MB, lebih besar = link). CLI di `packages/cli`. Indikator berjalan = polling 5 detik | Selesai | 10 |

## Catatan Fitur yang Selesai di Luar Tabel MVP Inti

Beberapa fitur fase lanjutan dan fondasi telah diimplementasikan mendahului jadwal untuk kebutuhan produksi:
- **F1 Sprint** (`fb08536`, `fed8916`, mockup `53`): Manajemen siklus sprint dan asosiasi bug dengan sprint aktif.
- **F4 Tenggat Otomatis SLA** (`8ec5e87`, `c09eed7`): Auto-calculate `dueAt` berbasis severity bug.
- **F5 Tren Laporan** (`6a50dbd`, mockup `66`): Grafik tren bug harian/mingguan dan kalkulasi rasio perbaikan.
- **F6 Portal Klien Hardened** (`60e2546`, `431fd95`, `3618f1c`, `d6c962b`, `48733ca`, mockup `70`, `71`): Tampilan publik terisolasi untuk klien/stakeholder tanpa kebocoran data internal.
- **F2 Dokumen Persetujuan & Diff** (`4149f00`, `36c9b10`, `58b9101`, `48d2de7`, mockup `50`, `51`, `52`): Workflow revisi dokumen bisnis dengan approval multi-stakeholder dan visual text diff.
- **Autentikasi Email + Password** (`0b34d9b`, `ad5f976`, mockup `60`): Login berbasis kredensial mandiri dengan hash crypto.scrypt aman dan rate limit IP.
- **Manajemen User Admin & Persetujuan** (mockup `61`, `62`): Review user tertunda dan approval/rejection dengan alasan.
- **Impor Bug & API Swagger Terintegrasi** (mockup `64`, `65`): Impor bulk JSON/CSV dan self-hosted interactive swagger docs.

### Catatan migrasi

- Repo sudah memakai Prisma Migrate (`prisma/migrations/20261026075205_init`). Setiap baris MVP yang mengubah skema = satu migrasi bernama, mis. `npx prisma migrate dev --name bug_fixed_in_build`. Jangan memakai `db push` di cabang fitur.
- Migrasi #10 paling berisiko (mengubah relasi bug ↔ item). Urutan aman: buat tabel join → salin data dari `Bug.testRunItemId` → ubah kode baca/tulis ke join → hapus kolom lama di migrasi berikutnya.
- `SKIPPED` ditambahkan ke enum; laporan lama yang menghitung `NOT_RUN` tidak berubah.
- Route MCP (`src/app/api/mcp/route.ts`) perlu menjawab `notifications/initialized` dan `ping` sebelum dipakai agent pi (#12).

## Yang sengaja ditunda

- Panel "Kriteria keluar · Test Plan" di Kesiapan rilis (`G4`) muncul setelah Test Plan ada (Fase 3). Di Fase 2, `G4` tampil tanpa panel itu.
- Onboarding (F10) memakai `dataset.md` sebagai seed sandbox; jangan membuat data dummy lain.
- Performa (F11) butuh minimal satu sprint data nyata agar angka bermakna.
