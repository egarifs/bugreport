# Revamp UI BugReport: paket handoff untuk agent

Paket ini berisi semua layar revamp (v2 sampai v5) sebagai mockup HTML dan screenshot, plus spesifikasi yang dibutuhkan agent untuk mengimplementasikannya di repo ini. Sumber desain: canvas "BugBoard" di claude.ai, diekspor 2 Nov 2026, diperbarui 3 Nov 2026 (review QA lead). Mulai dari `ROADMAP.md`.

## Isi folder

| Path | Isi |
|---|---|
| `mockups/*.html` | Mockup statis per layar. Buka langsung di browser; tautan antar-layar berfungsi. |
| `screenshots/*.png` | Render 1x dari setiap mockup, untuk agent yang membaca gambar. |
| `index.html` | Daftar semua layar dengan thumbnail. |
| `README.md` | Dokumen ini: aturan, peta layar ke file, dan tugas berurutan. |
| `ROADMAP.md` | Urutan implementasi: MVP inti QA, fase berikut, dan perubahan skema per langkah. **Mulai dari sini.** |
| `PROMPTS.md` | Prompt siap pakai untuk agent coding: pembuka sesi dan per langkah ROADMAP. |
| `acceptance/*.md` | Kriteria terima Diberikan/Ketika/Maka per fitur MVP. |
| `dataset.md`, `dataset.json` | Satu dataset cerita (CRM Sismedika · Sprint 14) untuk board, seed sandbox, dan e2e. |
| `agent/bugboard-qa-runner.md` | Instruksi untuk agent QA (pi, Claude Code, dsb.) yang dijalankan di folder lokal QA (F9). |

## Cara membaca mockup

Mockup adalah acuan **layout, hierarki, copy, dan interaksi**. Mockup **bukan** acuan kode warna: semua warna di kode harus memakai token Tailwind (lihat "Aturan wajib" no. 1). Mockup v2 (`00`, `01`, `12`, `13`, `14`) masih memakai palet slate dingin yang lama; layout dan copy-nya tetap berlaku, warnanya otomatis ikut token.

Teks berkurung seperti `[N]`, `[TGL]`, `[VERSI]`, `[URL ...]`, `[Nama run]`, dan baris berlabel `[Contoh]` adalah **placeholder data**. Isi dengan data asli dari database; jangan dikodekan sebagai teks.

## Status saat ini (sudah ada di kode)

- **Fondasi tema (Fase 1).** Token di `src/lib/theme-tokens.cjs`, dipasang sebagai CSS variable oleh `tailwind.config.js`. Tema Ikut sistem / Terang / Gelap di `src/lib/theme.ts` dan menu profil. Grain kertas di `src/app/globals.css`. Badge baru di `src/components/ui/bug-badges.tsx`.
- **Bagikan laporan Kesiapan rilis.** `src/app/projects/[key]/reports/share-report-button.tsx`, `src/app/api/projects/[key]/reports/pdf/route.ts`, `src/lib/report-pdf.tsx`, `src/lib/report-share.ts`.
- Semua layar lain di bawah **belum** diimplementasikan.

## Aturan wajib

1. **Warna hanya dari token.** Jangan menulis hex atau class arbitrary (`bg-[#...]`). Mode gelap otomatis jika token dipakai. Pemetaan dari mockup:

   | Hex di mockup (hangat v3+) | Hex di mockup (dingin v2) | Class Tailwind |
   |---|---|---|
   | `#F6F4EF` | `#F4F6F7` | `bg-slate-50` (latar halaman) |
   | `#FFFDF9` | `#fff` | `bg-surface` (kartu, panel, input) |
   | `#F1EEE7`, `#ECE7DE` | `#E9EDF0` | `bg-slate-100` (sidebar, header tabel, hover) |
   | `#E2DDD3` | `#D3DAE0` | `border-slate-200` |
   | `#8F877A` | `#B8C2CB` | `border-slate-300` (border input) |
   | `#1F1C17` | `#15212B` | `text-slate-900` |
   | `#2E2A23`, `#3E3930` | `#2A3641`, `#3B4752` | `text-slate-700`, `text-slate-600` |
   | `#5C564C` | `#4E5A65` | `text-slate-500` (meta) |
   | `#7A7366` | `#5F6B76` | `text-slate-400` (glyph netral) |
   | `#1E5AA8` (isian) | sama | `bg-action`, hover `bg-action-hover`, teks di atasnya `text-white` |
   | `#1E5AA8` (teks/tautan) | sama | `text-link` |
   | `#E7ECF4` + `#174A8C` | `#E8EFF8` | `bg-action-soft text-link` (item nav aktif, baris terpilih) |
   | `#1F1C17` sebagai isian | `#15212B` | `bg-ink text-on-ink` |
   | `#B42318`, `#FDECEA` | sama | `text-bad`, `bg-bad-bg`, `border-bad-border`, isian `bg-bad-solid` |
   | `#14783D`, `#E9F3EA` | sama | `text-ok`, `bg-ok-bg`, `border-ok-border`, isian `bg-ok-solid` |
   | `#8A6100`, `#FDF6DC` | sama | `text-warn`, `bg-warn-bg`, `border-warn-border` |
   | `#5B3A99` | sama | `text-violet`, `bg-violet-bg` |
   | warna severity | sama | `text-sev-{blocker,high,medium,low}`, `bg-sev-*`, `bg-sev-*-bg` |
   | latar modal gelap | `rgba(...)` | `bg-scrim/40`, `bg-scrim/60` |

   Jika butuh warna baru, tambahkan ke `theme-tokens.cjs` (terang **dan** gelap), lalu pastikan `npm test` (uji kontras) tetap lolos.
2. **Tipografi.** `font-sans` (Atkinson Hyperlegible) dan `font-mono` (Atkinson Hyperlegible Mono) untuk ID, kode, dan kunci. Font hanya punya ketebalan 400 dan 700: mockup `600` jadi `font-bold`, `500` jadi `font-normal` kecuali memang penekanan. Ukuran terkecil 13px (`text-xs` sudah 13px). Mockup memakai Geist/Atkinson via Google Fonts; abaikan link font di mockup.
3. **Komponen yang sudah ada, jangan dibuat ulang:** `SeverityBadge`, `StatusBadge`, `StatusGlyph`, `SEVERITY_STYLE`, `STATUS_LABEL` dari `bug-badges.tsx`; `ShareReportButton`; `ActionForm`/`SubmitButton` dari `components/ui/action-form.tsx`.
4. **Aksesibilitas.** Target klik minimal 44px (`min-h-[44px]`). Setiap input punya `<label>`. Tombol ikon punya `aria-label`. Item navigasi aktif memakai `aria-current="page"`. Pintasan keyboard tidak boleh aktif saat fokus ada di input/textarea/select.
5. **Gerak.** Pakai `duration-fast` (120ms, hover), `duration-base` (180ms, panel/tab), `duration-slow` (240ms, dialog/toast/perayaan) dengan `ease-out`. `globals.css` sudah mematikan animasi untuk `prefers-reduced-motion`.
6. **Hak akses di server.** Gunakan `checkProjectPermission`/`requireProjectPermission` (`src/lib/authz.ts`) dan `hasPermission`/`canTransitionBug` (`src/lib/permissions.ts`). Role Client, Vendor, dan Viewer tidak pernah melihat komentar `INTERNAL` (`note.internal.read`).
7. **Data.** Pakai model Prisma yang ada. Jangan mengubah skema tanpa persetujuan pemilik repo; tugas yang butuh skema baru ditandai **(butuh keputusan)**.
8. **Bahasa.** Copy UI dalam bahasa Indonesia, mengikuti teks di mockup.
9. **Verifikasi setiap tugas.** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, lalu cek manual di tema Terang dan Gelap, di jendela browser **1366×768**.
10. **Layout desktop: lebar penuh, teks dibatasi.** Acuan layar wajib 1366×768 (laptop kantor). Mockup v2–v5 digambar di 1440; mockup `26`/`27` digambar tepat di 1366×768.
    - Shell, header halaman, tabel, daftar, panel, dan papan memakai **seluruh lebar** area konten. Jangan membungkus halaman dengan kontainer `max-w-*` + `mx-auto`. Padding halaman `px-6`, `xl:px-8`.
    - Yang dibatasi hanya **teks bacaan panjang**: paragraf dan isi dokumen `max-w-prose`; kolom percakapan chat `max-w-3xl mx-auto`; kolom isian form `max-w-3xl`. Sisa lebar dipakai panel pendamping (cek duplikat, ringkasan, metadata), bukan dibiarkan kosong.
    - Halaman dengan composer atau aksi utama (chat, eksekusi test run) memakai tinggi layar: `h-dvh` dengan area isi yang menggulir sendiri (`min-h-0 overflow-auto`), sehingga composer/aksi selalu terlihat tanpa menggulir halaman.
    - Kriteria lolos di 1366×768: tidak ada gulir horizontal; tidak ada ruang kosong lebih dari 240px di kiri/kanan halaman daftar; aksi utama terlihat tanpa menggulir halaman.

## Fakta domain yang dipakai di banyak layar

- **Status bug** (`BugStatus`): `DRAFT, OPEN, IN_PROGRESS, READY_FOR_VERIFICATION, CLOSED, REOPENED, INVALID, DUPLICATE, CANNOT_REPRODUCE, WONT_FIX`. Transisi yang sah ada di `BUG_TRANSITIONS` (`permissions.ts`). Dari `DRAFT` hanya boleh ke `OPEN`, `INVALID`, `DUPLICATE`, `CANNOT_REPRODUCE`.
- **Bug aktif** = semua status selain `CLOSED, INVALID, DUPLICATE, CANNOT_REPRODUCE, WONT_FIX` (lihat `DONE` di `src/lib/report.ts`).
- **Riwayat status** ada di `AuditLog` dengan `action = "bug.status_change"`, `entityId = bug.id`, `changes.before.status` dan `changes.after.status`. Perubahan via MCP agent memakai `actorType = "agent"`; periksa `src/lib/mcp-tools.ts` apakah agent juga menulis `bug.status_change`.
- **Notifikasi**: `Notification.type` = `assign | comment | status | draft | user_pending`; belum dibaca = `readAt` null.
- **Zona waktu** untuk tampilan dan reset harian: Asia/Jakarta (WIB). Lihat `formatWib` di `src/lib/report-share.ts`.

## Peta alur E2E (mulai dari sini)

Canvas dan `index.html` disusun per alur, dibaca kiri ke kanan. Setiap alur diawali board peta alur (persona, langkah, perubahan status, layar terkait).

| Alur | Peta | Layar berurutan | Persona |
|---|---|---|---|
| 1 Masuk & akses | `80` | `60` → `61` → `62` → `20` | Semua, Admin situs |
| 2 Siklus bug | `81` | `G3` → `10`/`11` → `G1` → `G2` → `21`/`G5` | QA, Developer, Vendor, Klien |
| 3 Siklus test | `82` | `23` → `23a` → `23b` → `24a` → `24b` | QA, Developer |
| 4 Requirement | `83` | `50` → `54` → `52`/`55` → `51` | PO/Admin, QA, Klien |
| 5 Sprint & rilis | `84` | `53` → `G4` → `15` → `66` | QA, PO/Admin, Klien |
| 6 Tanya AI | `85` | `26` → `27` | QA, Developer, Vendor, PO/Admin |
| 7 Portal klien | `86` | `70` → `71` | Klien |
| 8 Admin & integrasi | `87` | `63` → `25` → `64` → `65` | PO/Admin, Admin situs |
| 9 Agent QA lokal | `90` | `95` → `92` → `93` → `91` → `94` | QA, PO/Admin |
| 10 Onboarding | `A0` | `A1` → `A2` → `A3` → `A4` → `A5` | Semua, PO/Admin |
| 12 Ringkasan grafik | — | `C1` | QA, PO/Admin (workload: lead) |
| 13 Navigasi | — | `D1` → `D2` → `D3` | Semua |
| 14 STLC & dokumen | `E0` | `E5` → `E2` → `E1` → `E3` → `E6` → `E4` | PO/Admin, QA, Developer |
| 15 Referensi & pola | — | `G6`, `G7` (berlaku untuk semua alur) | Semua |
| 11 Performa | `B0` | `B1` / `B2` → `B3` → `B4`, `B5` | QA, Dev/Vendor, PO/Admin, Klien (agregat) |

Fondasi untuk semua alur: `01`, `02`, `03`. Layar yang sudah digantikan (`00`, `12`, `13`, `14`, `22`, `24`, `40`) hanya sebagai riwayat.

## Daftar layar

| No | Mockup | Layar | File utama di repo |
|---|---|---|---|
| 00 | `00-audit-ui` | Audit UI lama (konteks, bukan layar) | — |
| 01 | `01-komponen-dan-tipografi` | Glyph status, meter severity, tipografi, kontrol | `components/ui/bug-badges.tsx` |
| 02 | `02-tema-warna-gerak` | Token terang/gelap, grain, gerak | `src/lib/theme-tokens.cjs`, `globals.css` |
| 03 | `03-momen-reward` | Bug ditutup, antrean kosong, rilis siap, ringkasan harian | lintas layar |
| 10/11 | `10-bug-triase`, `11-bug-triase-gelap` | Daftar bug + panel triase | `app/projects/[key]/page.tsx` |
| 12 | `12-bug-detail` | Detail bug (v2, digantikan `G1`) | `app/projects/[key]/bugs/[number]/page.tsx` |
| 13 | `13-bug-laporkan` | Laporkan bug (v2, digantikan `G3`) | `app/projects/[key]/bugs/new/page.tsx` |
| 14 | `14-kesiapan-rilis` | Kesiapan rilis (v2, digantikan `G4`) | `app/projects/[key]/reports/page.tsx` |
| 15 | `15-bagikan-laporan` | Dialog bagikan PDF + WA | `reports/share-report-button.tsx` |
| 20 | `20-semua-project` | Semua project | `app/projects/page.tsx` |
| 21 | `21-notifikasi` | Notifikasi | `app/notifications/page.tsx` |
| 22 | `22-ai-chat` | AI Chat (v5, digantikan `26`/`27`; kartu jawaban dan chip saran tetap berlaku) | `app/projects/[key]/chat/` |
| 26 | `26-ai-chat-riwayat-bersama` | AI Chat dengan riwayat bersama, tampilan Admin/internal, 1366×768 | `app/projects/[key]/chat/` |
| 27 | `27-ai-chat-tampilan-vendor` | AI Chat, tampilan Vendor + menu ganti nama/hapus, 1366×768 | `app/projects/[key]/chat/` |
| 23 | `23-test-case` | Test case | `app/projects/[key]/test-cases/page.tsx` |
| 23a | `23a-test-case-tambah` | Tambah/ubah test case sebagai halaman (bukan modal), cek test case mirip, konteks §bagian | `app/projects/[key]/test-cases/new`, `[id]/edit` |
| 23b | `23b-test-case-riwayat` | Detail test case: tab riwayat eksekusi, versi, bug terkait (F8) | `app/projects/[key]/test-cases/[id]` (baru) |
| 24a | `24a-test-run-log-percobaan` | Eksekusi test run: log percobaan, Perlu re-run, Ada versi baru, banyak bug (F8) | `app/projects/[key]/test-runs/[runId]/page.tsx` |
| 24b | `24b-test-run-tutup` | Dialog tutup test run: wajib tuntas, keputusan, catatan (F8) | `app/projects/[key]/test-runs/[runId]/` |
| 24 | `24-test-run` | Eksekusi test run | `app/projects/[key]/test-runs/[runId]/page.tsx` |
| 25 | `25-pengaturan` | Pengaturan project | `app/projects/[key]/settings/` |
| 30–35 | `3x-pdf-*` | PDF A4: rilis, rekap periode, detail bug | `src/lib/report-pdf.tsx` |
| 50 | `50-dokumen-baca` | Dokumen bisnis: daftar + daftar bagian, baca per bagian, panel "Dirujuk oleh" (F2) | `app/projects/[key]/docs/` |
| 51 | `51-dokumen-perbedaan-persetujuan` | Perbedaan v4→v5 per bagian, catatan perubahan, dampak, Setujui/Tolak (F2) | `app/projects/[key]/docs/` |
| 52 | `52-dokumen-unggah-revisi` | Dialog unggah revisi: bagian dikenali, alasan wajib, diminta oleh, sprint (F2) | `app/projects/[key]/docs/` |
| 54 | `54-dokumen-tambah-pilih-sumber` | Dialog tambah dokumen: sumber Word/PDF atau Notion (F2) | `app/projects/[key]/docs/` |
| 55 | `55-dokumen-revisi-dari-notion` | Dokumen Notion: perubahan terdeteksi, buat revisi tanpa unggah (F2) | `app/projects/[key]/docs/` |
| 53 | `53-sprint` | Sprint: ringkasan, bug dengan tenggat dan "Diperbaiki di", test run, revisi dokumen (F1, F3, F4) | baru |
| 60 | `60-login` | Masuk dengan Google (F7) | `app/login/page.tsx` |
| 61 | `61-menunggu-persetujuan` | Status akun: menunggu / ditolak / ditangguhkan (F7) | `app/pending/page.tsx` |
| 62 | `62-admin-persetujuan-user` | Admin situs: setujui pendaftar + project awal + peran (F7) | `app/admin/users/page.tsx` |
| 63 | `63-buat-project` | Buat project: kode, modul, anggota, SLA (F7) | `app/projects/new/page.tsx` |
| 64 | `64-impor-bug` | Dialog impor bug dari Markdown, pratinjau + validasi (F7) | `bugs/import/bug-import-modal.tsx` |
| 65 | `65-api-swagger` | API & Swagger: daftar endpoint, detail, contoh (F7) | `app/api-docs/page.tsx` |
| 66 | `66-laporan-tren` | Laporan tab Tren (F5) | `app/projects/[key]/reports/` |
| 70 | `70-portal-klien-bug` | Portal klien: bug kami + status rilis (F6) | baru |
| 71 | `71-portal-klien-dokumen` | Portal klien: dokumen + komentar per bagian (F6) | baru |
| 80–87, 90 | `8x-alur-*`, `90-alur-*` | Peta alur E2E (bukan layar) | — |
| 91 | `91-test-run-hasil-agent` | Test run: hasil via agent dan impor JUnit, bukti, bug (F9) | `test-runs/[runId]/page.tsx` |
| 92 | `92-test-case-siap-agent` | Test case: Siap untuk agent, data uji, kesiapan (F9) | form test case |
| 93 | `93-hubungkan-agent` | Profil: kunci pribadi preset Agent QA, setup MCP/CLI (F9) | profil (baru) |
| 94 | `94-sesi-agent` | Sesi agent: hasil dan bug yang dikirim (F9) | baru |
| 95 | `95-pengaturan-sumber-akun-uji` | Pengaturan: link sumber akun uji, visibilitas, penanggung jawab (F9) | `settings/` |
| G1 | `G1-detail-bug-v3` | Detail bug v3: banner verifikasi di build, Lolos/Masih gagal, field Sprint/Tenggat/Ditemukan/Diperbaiki, §requirement, TC Perlu re-run, pelapor tambahan | `app/projects/[key]/bugs/[number]/page.tsx` |
| G2 | `G2-gabung-duplikat` | Dialog tandai duplikat dan gabungkan, urungkan 10 menit | `bugs/[number]/` |
| G3 | `G3-laporkan-bug-v3` | Laporkan bug v3: duplikat inline, panduan severity × prioritas | `app/projects/[key]/bugs/new/page.tsx` |
| G4 | `G4-kesiapan-rilis-v3` | Kesiapan rilis v3: penghalang + kriteria keluar Test Plan (panel kanan baru di Fase 3) | `app/projects/[key]/reports/page.tsx` |
| G5 | `G5-preferensi-notifikasi` | Profil › Notifikasi: per jenis Segera/Harian/Per sesi/Mati, cakupan, mode fokus | profil (baru) |
| G6 | `G6-kamus-status-izin` | Referensi: kamus status bug/test/requirement + matriks hak akses | `src/lib/status-dictionary.ts` (baru), `permissions.ts` |
| G7 | `G7-state-kosong-error` | Pola state: kosong, filter tanpa hasil, skeleton, gagal memuat, tanpa akses, data banyak, validasi, gelap | komponen bersama |
| 40 | `40-portal-klien-konsep-v1` | Konsep awal portal klien (mobile) | belum ada |

## Tugas berurutan

Kerjakan satu tugas per PR/commit. Setiap tugas selesai bila semua kriteria terpenuhi dan langkah verifikasi (aturan no. 9) lolos.

### T1. Shell dan navigasi
Mockup: sidebar di `10`; rail ringkas 72px di `12`–`14`, `22`–`25`. File: `components/layout/app-sidebar.tsx`, `app-shell.tsx`, `notification-bell.tsx`.
- Satu tombol pemilih project (logo kode project + nama + peran) menggantikan judul ganda dan dropdown "Pilih Project".
- Urutan menu: Bug (badge jumlah `DRAFT`), Test case, Dokumen bisnis; grup "Insight": Kesiapan rilis, AI Chat; di dasar: Pengaturan, API dan Swagger, Persetujuan user (admin saja, badge jumlah user `PENDING`), Tema, profil.
- Item aktif `bg-action-soft text-link font-bold` dengan `aria-current="page"`.
- Lonceng notifikasi pindah ke header halaman (kanan atas), titik merah hanya bila ada yang belum dibaca.
- Mode ciut (sudah ada di localStorage) menampilkan rail ikon 72px dengan `aria-label` per ikon.

### T2. Daftar bug dan triase
Mockup: `10`, `11`. File: `app/projects/[key]/page.tsx` + komponen klien baru untuk panel triase.
- Tab: Perlu review (status `DRAFT`, dengan jumlah), Tugas saya, Semua bug. Filter (cari, Severity, Modul, Sumber) langsung berlaku lewat search params; hapus tombol "Terapkan".
- Hapus garis warna di kiri baris.
- Kolom tab Perlu review: ID (mono), Judul + meta (modul · sumber · jumlah komentar, atau "Modul belum diisi" `text-warn`), Severity, Status, Menunggu (umur sejak `createdAt`).
- Memilih baris membuka panel samping: judul, pelapor, Aktual (`text-bad`) lalu Diharapkan (`text-ok`), form triase (severity, priority, modul, assignee), hasil cek duplikat (pakai `api/projects/[key]/duplicates`), tombol "Terima, jadikan Open" dan menu "Tolak" (Invalid, Duplikat dengan pilihan bug induk, Tidak bisa direproduksi).
- "Terima" menolak dengan pesan jelas bila modul kosong (aturan yang sudah ada).
- Pintasan: J/K pindah baris, A terima, X tolak, D duplikat, Enter buka detail. Tampilkan petunjuk pintasan di bawah tabel.
- Kartu "Hari ini" di atas tab: jumlah direview (perubahan dari `DRAFT`), ditutup (ke `CLOSED`), diverifikasi (dari `READY_FOR_VERIFICATION`) oleh user saat ini sejak 00.00 WIB, dari `AuditLog`. Sembunyikan bila semuanya nol. Tanpa streak atau perbandingan antar orang.
- Antrean kosong: tampilkan empty state dari `03` ("Antrean bersih" + tautan Tugas saya).

### T3. Detail bug
Mockup: `G1` dan `G2` (v3; `12` hanya riwayat) (+ momen "Bug jadi Closed" di `03`). File: `app/projects/[key]/bugs/[number]/page.tsx`.
- Header: ID, judul, `StatusBadge`, `SeverityBadge`, modul, sumber, umur. Tombol utama = transisi berikutnya yang paling umum dan diizinkan (`canTransitionBug`), misalnya `IN_PROGRESS` jadi "Kirim ke verifikasi"; transisi lain di menu "Pindah status".
- Isi: Deskripsi, Langkah (daftar bernomor), Aktual (`bg-bad-bg`) **lalu** Diharapkan (`bg-ok-bg`), Bukti (kartu Rekaman Jam, grid lampiran, tautan), Komentar dengan tab Publik/Internal (tab Internal hanya untuk yang punya `note.internal.read`; komentar internal ditandai `bg-warn-bg`).
- Sidebar: properti (assignee, priority, modul, pelapor, direview oleh/kapan, reopen, lingkungan, task, bug terkait, test run), "Waktu di tiap status" dari `AuditLog`, dan log aktivitas.
- Saat bug jadi `CLOSED`: glyph berubah jadi centang (240–320ms) dan toast "CRM-x ditutup · Urungkan" selama 6 detik.

### T4. Laporkan bug
Mockup: `G3` (v3; `13` hanya riwayat). File: `app/projects/[key]/bugs/new/page.tsx` (+ `duplicate-checker.tsx`, `screenshot-input.tsx` yang sudah ada).
- Urutan: Judul, Modul, Severity (ketiganya ditandai teks "wajib"), Priority; Deskripsi; Langkah (font mono); **Hasil aktual lalu Hasil yang diharapkan**; Bukti (tempel/seret screenshot, Rekaman Jam, Link task); "Lingkungan teknis" di dalam `<details>`.
- Panel "Mungkin sudah dilaporkan" di samping form, diisi `duplicate-checker` saat judul diketik (debounce).
- Tombol "Kirim sebagai Draft".

### T5. Kesiapan rilis
Mockup: `G4` (v3; `14` hanya riwayat) (+ momen "Rilis jadi siap" di `03`). File: `app/projects/[key]/reports/page.tsx`.
- Verdict jadi hero: ikon, BLOCKED/READY, kalimat ringkas, angka Blocker / High terbuka / Total aktif.
- Tabel penghalang dengan kolom "Langkah berikutnya": `DRAFT` "Review di antrean triase", `OPEN` tanpa assignee "Tugaskan ke developer", `IN_PROGRESS` "Menunggu {assignee}", `READY_FOR_VERIFICATION` "Verifikasi".
- Bar severity dengan angka, distribusi status (bar bertumpuk + legenda), beban per assignee ("Belum di-assign" disorot `bg-warn-bg`), Draft lebih dari 3 hari.
- Saat verdict berubah ke READY untuk suatu versi, animasi transisi diputar sekali (simpan per versi di localStorage).
- Pertahankan tombol Bagikan dan Ekspor CSV.

### T6. PDF Rekap periode dan Detail bug
Mockup: `15`, `32`–`35`. File: `src/lib/report-pdf.tsx`, route PDF, `share-report-button.tsx`.
- Route menerima `type=release|recap|bug` (+ rentang tanggal untuk recap, `bug` key untuk detail). Dialog bagikan mendapat pemilih jenis laporan seperti `15`.
- Aturan versi Eksternal/Internal sama dengan PDF rilis: eksternal menyembunyikan komentar internal, mengganti "Draft" jadi "Menunggu review", dan menampilkan pelapor agent sebagai "Tim QA".
- Rekap: bug dibuat dalam rentang; per severity, per modul, per sumber (agent vs manusia dari `AuditLog.actorType` atau aksi `bug.create_mcp`); daftar lengkap; bagian "Catatan internal" hanya di versi internal.

### T7. Notifikasi
Mockup: `21`, preferensi di `G5`. File: `app/notifications/page.tsx`, `app/api/notifications/route.ts`, `notification-bell.tsx`.
- Notifikasi `user_pending` digabung per user (tanpa duplikat), dengan pilihan peran dan tombol Setujui/Tolak langsung (pakai aksi persetujuan yang sudah ada di `app/admin/users/page.tsx`).
- Grup "Pekerjaan Anda" untuk `assign`, `comment`, `status`, `draft`; notifikasi `draft` dari project yang sama digabung jadi "N bug baru menunggu review".
- Titik biru hanya untuk `readAt` null. "Tandai semua dibaca" tetap ada.

### T8. Semua project
Mockup: `20`. File: `app/projects/page.tsx`.
- Tabel: project (kode + nama + jumlah anggota/modul), peran Anda, bug aktif, penghalang rilis (jumlah Blocker/High aktif atau "Siap rilis"), menunggu review (jumlah `DRAFT`), aktivitas terakhir.
- Tab: Saya anggota, Semua (admin), Arsip (`Project.isArchived`). Pencarian nama/kode.
- Melipat project uji: pakai `Project.isTest` (lihat "Keputusan siap development"); jangan menebak dari nama.

### T9. AI Chat dengan riwayat bersama
Mockup: `26`, `27` (layout dan perilaku), `22` (kartu jawaban, chip saran untuk percakapan baru). File: `app/projects/[key]/chat/page.tsx`, `chat-box.tsx`, `app/api/projects/[key]/chat/route.ts`, `src/lib/chat-tools.ts`, `src/lib/chat-quota.ts`, `prisma/schema.prisma`.

Keputusan pemilik repo (2 Nov 2026), **skema baru sudah disetujui** untuk tugas ini:
- Bentuk: **daftar percakapan** per project. Semua orang yang berhak bisa membuka, membaca, dan **ikut bertanya** di percakapan orang lain.
- Akses **dipisah per jalur** (`lane`), ditetapkan sekali saat percakapan dibuat dari peran pembuatnya:
  - `INTERNAL`: dibuat oleh Admin, QA, Developer, atau admin situs. Terlihat dan bisa diikuti hanya oleh yang punya `note.internal.read`. AI boleh memakai catatan internal.
  - `VENDOR`: dibuat oleh Vendor. Terlihat dan bisa diikuti semua yang punya `chat.ask`. AI **tidak pernah** memakai catatan internal di percakapan ini, siapa pun yang bertanya.
  - Client dan Viewer tetap tidak punya akses chat.
- Pesan lama (sebelum fitur ini) **tetap pribadi**: hanya terlihat oleh penulisnya, di grup "Chat pribadi lama" di dasar daftar.
- Judul = pertanyaan pertama, dipotong di batas kata ≤ 60 karakter + "…". Tanpa panggilan AI.
- Ganti nama dan hapus: **pemilik percakapan atau Admin project** (dan admin situs). Hapus pakai dialog konfirmasi, menghapus percakapan beserta pesannya, dan menulis `AuditLog` (`action: "chat.conversation_delete"`, simpan judul dan jumlah pesan di `changes.before`).

Skema (tidak ada folder `prisma/migrations` di repo; terapkan perubahan dengan cara yang dipakai repo saat ini dan sebutkan caranya di PR):
- Model baru `ChatConversation`: `id`, `projectId` (relasi Project, cascade), `createdById` (relasi User), `title String`, `lane ChatLane`, `isShared Boolean @default(true)`, `lastMessageAt DateTime`, `createdAt`. Index `[projectId, lane, lastMessageAt]` dan `[projectId, createdById]`.
- Enum baru `ChatLane { INTERNAL VENDOR }`.
- `ChatMessage` tambah `conversationId` (relasi `ChatConversation`, cascade) dan index `[conversationId, createdAt]`. `userId` tetap: pada pesan `USER` = penanya, pada `ASSISTANT` = penanya yang dijawab (untuk teks "Menjawab Rina").
- Migrasi data: untuk setiap pasangan (project, user) yang punya pesan lama, buat satu `ChatConversation` dengan `isShared=false`, `title="Chat pribadi lama"`, `lane` dari peran user saat ini, lalu isi `conversationId` pesan-pesannya. Setelah itu `conversationId` wajib (non-null).

Logika (taruh di `src/lib/chat-access.ts` beserta tes `chat-access.test.ts`):
- `laneForRole(role, isAdmin)`: `VENDOR` untuk role Vendor, selain itu `INTERNAL`.
- `canViewConversation(conv, viewer)`: `isShared=false` → hanya `createdById`; `INTERNAL` → `note.internal.read`; `VENDOR` → `chat.ask`.
- `canPostToConversation` = `canViewConversation` dan `chat.ask`.
- `canManageConversation`: pemilik, Admin project, atau admin situs.
- `conversationTitle(text)`: aturan judul di atas.
- Tes wajib: Vendor tidak bisa melihat `INTERNAL`; Developer bisa melihat dan ikut di `VENDOR`; percakapan pribadi lama hanya untuk pemiliknya; judul dipotong di batas kata.

API:
- `GET /api/projects/[key]/chat/conversations?mine=1&q=…&cursor=…`: daftar yang boleh dilihat viewer, urut `lastMessageAt` turun, 30 per halaman. Isi: judul, pembuat (nama + peran), `lane`, jumlah pesan, `lastMessageAt`, `isShared`.
- `GET /api/projects/[key]/chat/conversations/[id]`: pesan beserta nama penanya. 404 (bukan 403) bila tidak boleh dilihat.
- `POST /api/projects/[key]/chat` body `{ conversationId?, message }`: tanpa `conversationId` membuat percakapan baru (judul dari pesan, `lane` dari peran). Dengan `conversationId`, cek `canPostToConversation`; pesan ke percakapan pribadi lama hanya oleh pemiliknya. Kirim `conversationId` di baris NDJSON pertama agar klien bisa pindah URL.
- `PATCH` (ganti nama, 1–80 karakter) dan `DELETE /api/projects/[key]/chat/conversations/[id]`: cek `canManageConversation`.
- Riwayat yang dikirim ke AI = 10 pesan terakhir **percakapan itu** (bukan per user). `ChatUserContext` dapat `lane`; di `executeChatTool`, `canSeeInternal = lane === "INTERNAL" && hasPermission(role, "note.internal.read", isAdmin)`.
- Batas 30 pesan/jam tetap per user; kuota token harian tetap per project.

UI (`26`, `27`):
- URL `/projects/[key]/chat?c=<id>`. Tanpa `c`: buka percakapan terbaru milik viewer, atau keadaan "Percakapan baru" (judul "Tanya tentang project" + chip saran dari `22`).
- Kolom daftar 304px: tombol "Baru", pencarian (judul atau nama penanya), segmen "Semua / Milik saya", grup Hari ini / Kemarin / 7 hari terakhir / Lebih lama, item berisi judul satu baris, avatar inisial + nama + jam + jumlah pesan, label jalur (`Internal` dengan ikon gembok, `Vendor` dengan ikon orang). Vendor tidak melihat label jalur dan mendapat catatan "Anda melihat percakapan jalur Vendor…". Grup "Chat pribadi lama [N]" terlipat di dasar.
- Header percakapan: judul, avatar penanya, "Dimulai {nama} ({peran}) · {tanggal} · {N} penanya", label jalur + siapa yang bisa melihat, meter kuota, tombol "Opsi percakapan" (menu Ganti nama / Hapus percakapan, hanya bila `canManageConversation`).
- Pertanyaan sendiri rata kanan (`bg-ink text-on-ink`); pertanyaan orang lain rata kiri dengan avatar, nama, peran, jam. Kartu jawaban menulis "Menjawab {nama}". Di jalur Vendor kartu jawaban memuat catatan "catatan internal tidak dipakai".
- Composer selalu terlihat di dasar (aturan no. 10), dengan teks siapa yang akan melihat pertanyaan.
- Pesan orang lain: ambil ulang saat jendela kembali fokus dan setiap 20 detik selama tab terlihat. Belum perlu websocket.
- Banner "Mode simulasi" tetap hanya untuk admin.

Kriteria selesai: semua tes `chat-access` lolos; login sebagai Vendor tidak bisa membuka percakapan `INTERNAL` lewat URL langsung (404); di 1366×768 daftar, isi, dan composer muat tanpa gulir halaman.

### T10. Test case
Mockup: `23`. File: `app/projects/[key]/test-cases/page.tsx`.
- Navigasi modul dengan jumlah, kartu peringatan untuk test case tanpa modul.
- Tabel dengan checkbox, kode, judul + meta, tipe, prioritas, hasil terakhir (status `TestRunItem` terbaru: `PASS`, `FAIL`, `BLOCKED`, atau "Belum dijalankan").
- Bar aksi untuk pilihan: "Pindah modul", "Buat test run dari pilihan" (ke `test-runs/new` dengan test case terpilih).
- **Form tambah/ubah = halaman** (`23a`): `/test-cases/new` dan `/test-cases/[id]/edit`, menggantikan `test-case-modal.tsx`. Modal hanya untuk aksi singkat (pindah modul, buat test run, impor, konfirmasi hapus).
  - Langkah berupa baris yang bisa ditambah, dihapus, dan diurutkan (seret + alternatif keyboard); disimpan ke kolom `steps` yang ada sebagai teks bernomor `1) … 2) …` (tanpa ubah skema).
  - Kode otomatis dari modul (mis. `TC-KTK-020`), bisa diubah; tetap unik per project.
  - Peringatan "perubahan belum disimpan" saat meninggalkan halaman; draf disimpan di `localStorage` per project.
  - Panel kanan: test case mirip (judul + modul) dengan aksi "Buka" / "Ini berbeda, lanjutkan"; isi §bagian dokumen yang dirujuk (rujukan §bagian bergantung F2, sembunyikan bila F2 belum ada).
  - Tombol Simpan, "Simpan & buat lagi" (modul, tipe, peran, prasyarat tetap terisi), pintasan Ctrl+Enter dan Ctrl+Shift+Enter.

### T11. Eksekusi test run
Mockup: `24`. File: `app/projects/[key]/test-runs/[runId]/page.tsx`.
- Bar progres bertumpuk (lolos/gagal/terblokir/belum), daftar test case dengan glyph status.
- Panel test case aktif: langkah, hasil yang diharapkan, isian hasil aktual (wajib bila gagal).
- Tombol Lolos (P), "Gagal, buat bug" (F), Terblokir (B); otomatis lanjut ke berikutnya.
- Gagal membuka form laporan yang sudah terisi dan tertaut lewat `testRunItemId` (jembatan Phase 2B yang sudah ada).

### T12. Pengaturan project
Mockup: `25`. File: `app/projects/[key]/settings/page.tsx`, `modules-section.tsx`.
- Tab vertikal lewat search param: Umum dan anggota, Modul, Agent dan API key, Kuota AI Chat.
- Modul: urutan lewat seret (dengan alternatif keyboard), menggantikan tombol Naik/Turun.
- API key: form buat kunci, daftar kunci dengan status, peringatan untuk kunci tanpa tanggal berakhir, aksi "Atur berakhir" dan "Cabut" (dengan konfirmasi).

### T14. Audit lebar halaman (aturan no. 10)
Terapkan aturan no. 10 ke semua halaman yang sudah ada, termasuk yang belum direvamp. Titik yang sudah ketahuan membatasi lebar: `app/notifications/page.tsx` (daftar `max-w-3xl`: jadikan lebar penuh), `app/projects/[key]/docs/[slug]/page.tsx` (artikel `max-w-4xl`: isi tetap `max-w-prose`, sisa lebar untuk daftar isi/metadata), `chat/chat-box.tsx` (diganti oleh T9). Cari juga `max-w-` lain dengan `grep -rn "max-w-" src/app src/components`. Lampirkan screenshot 1366×768 setiap halaman di PR.

### T13. Portal klien (Fase 2)
Mockup `40` hanya konsep awal dengan status lama. **Jangan diimplementasikan** sebelum desain portal klien yang baru disetujui pemilik repo.

## Fase berikut: kebutuhan tim yang belum tercakup (keputusan 2 Nov 2026)

Semua F1–F8 sudah punya mockup (lihat tabel di atas); isi dokumen, nama, tanggal, dan angka di mockup adalah contoh; spesifikasi di bawah adalah keputusan pemilik repo yang menjadi dasar desain. Semua tugas F1–F6 butuh perubahan skema dan sudah disetujui sebagai arah, tetapi detail skema final ditetapkan bersama desainnya.

Konteks kerja: tim memakai agile, requirement berubah per sprint. Sebagian tim menulis PRD di **Word/PDF** dengan judul bagian **bernomor** (`4.2 Hak akses`), sebagian di **Notion**; sumber dipilih **per dokumen**. Tim eksternal memakai **laptop** (desktop 1366×768 cukup). Notifikasi **cukup di dalam aplikasi**.

### F1. Sprint ringan
Mockup: `53`. Navigasi: item "Sprint" di bawah "Bug" (lihat rail di `50`–`53`).
- Model `Sprint`: nama, tanggal mulai, tanggal selesai, status (aktif/selesai), per project.
- Bug, test run, dan revisi dokumen bisa dikaitkan ke satu sprint. Filter "Sprint" di daftar bug, test run, dan laporan.
- Tidak menggantikan versi rilis; keduanya berdampingan.

### F2. Dokumen bisnis untuk requirement yang cepat berubah
Mockup: `50` (baca), `51` (perbedaan + persetujuan), `52` (unggah revisi Word/PDF), `54` (tambah dokumen, pilih sumber), `55` (revisi dari Notion).
- **Sumber per dokumen** (`BusinessDoc.source`: `FILE` | `NOTION`), dipilih saat dokumen ditambahkan dan tidak bisa diganti setelahnya (buat dokumen baru bila pindah sumber). Daftar dokumen menampilkan ikon sumber (W/P/N).
- **Word/PDF**: setiap revisi diunggah ulang (model `BusinessDoc`/`BusinessDocVersion` yang ada).
- **Notion**:
  - Lewat Notion API dengan *internal integration* (gratis). Token disimpan Admin di Pengaturan › Integrasi (terenkripsi, tidak pernah dikirim ke klien). Halaman harus dibagikan ke integrasi "BugBoard" lewat ••• › Connections; bila belum, tampilkan petunjuk di `54`.
  - Bagian = Heading 1–3. Nomor (`2.1`) dihitung dari urutan heading untuk tampilan, tetapi rujukan dan pencocokan antar-versi memakai **ID blok heading** Notion, sehingga tidak putus saat judul atau urutan berubah.
  - Setiap revisi = snapshot isi halaman (teks per bagian) disimpan sebagai `BusinessDocVersion` baru (tanpa file; `storedPath` kosong, simpan `notionLastEditedTime`). Snapshot yang sudah dikirim tidak ikut berubah bila Notion berubah lagi.
  - Pemeriksaan perubahan: otomatis saat dokumen dibuka bila pemeriksaan terakhir lebih dari 1 jam (bandingkan `last_edited_time`), atau tombol "Periksa perubahan". Bila berubah: label "Ada perubahan" di daftar dan banner "Buat revisi" (`55`). Tidak ada sinkron otomatis menjadi versi berlaku.
  - Batas laju Notion API (~3 permintaan/detik): ambil blok per halaman secara berurutan dan simpan cache.
- Dari titik ini, alur revisi sama untuk kedua sumber: catatan perubahan wajib, persetujuan PO/Admin, perbedaan, label "Perlu dicek ulang".
- **Bagian dokumen (Word/PDF)**: saat unggah, isi dipecah per judul bernomor (`^\d+(\.\d+)*\s+Judul`). Setiap bagian disimpan dengan nomor, judul, dan isi. Antar-versi, bagian dicocokkan lewat nomor + judul; bila judul berubah tapi nomor sama, dianggap bagian yang sama dan diubah.
- **Catatan perubahan wajib** saat unggah revisi: alasan singkat, diminta oleh (PO/klien/internal), kaitan sprint opsional.
- **Persetujuan**: revisi baru berstatus "Menunggu persetujuan" dan **belum** dipakai sebagai acuan QA maupun AI chat. Yang menyetujui: **PO/Admin project**. Tercatat di `AuditLog`. Penolakan wajib alasan.
- **Lihat perbedaan**: per bagian, tandai Ditambah / Diubah / Dihapus, dengan diff teks di bagian yang diubah.
- **Rujukan bagian**: bug dan test case bisa menautkan ke satu atau lebih bagian (`§4.2`). Tampil sebagai chip yang membuka bagian itu.
- **Tandai yang terdampak**: saat revisi disetujui, bug aktif dan test case yang menaut ke bagian yang diubah/dihapus mendapat label "Perlu dicek ulang" (bisa dihapus manual setelah dicek). Bagian yang dihapus membuat rujukan "putus" dan meminta pilih ulang.
- AI chat hanya membaca versi yang **disetujui**.

### F3. Diperbaiki di versi/build
Mockup: kolom "Diperbaiki di" dan kartu "Siap dites di build" di `53`.
- Kolom baru pada bug: versi dan build perbaikan.
- **Wajib** diisi saat bug dipindah ke `READY_FOR_VERIFICATION`; validasi di server, bukan hanya di form.
- Filter QA "Siap dites di build X" di daftar bug; tampil di detail bug dan PDF.

### F4. Tenggat per bug
Mockup: kolom "Tenggat" dan kartu "Lewat tenggat" di `53`.
- Tenggat terisi otomatis dari SLA severity (`src/lib/sla.ts`) saat bug dibuka.
- QA/Admin bisa mengubahnya (mis. mengikuti akhir sprint) dengan **alasan wajib**, tercatat di audit log.
- Daftar bug: kolom/urutan tenggat, penanda "lewat tenggat".

### F5. Tab "Tren" di Laporan
Mockup: `66`. Grafik: bar berkelompok masuk vs selesai per minggu; pakai SVG sederhana atau pustaka chart yang ringan, warna dari token.
- Di halaman Laporan, tab "Tren" di samping "Kesiapan rilis". Filter sprint dan periode.
- Isi: bug masuk vs selesai per minggu, jumlah lewat SLA/tenggat, reopen rate, rata-rata waktu sampai Closed, per severity dan per modul.
- Bagikan sebagai PDF "Rekap periode" (`32`/`33`).

### F6. Portal klien sederhana (menggantikan T13)
Mockup: `70`, `71`. Klien yang masuk diarahkan ke portal (navigasi atas, tanpa rail internal). Label status eksternal memakai `statusLabelFor`.
Peran Client mendapat tampilan sendiri yang lebih sederhana, berisi:
- **Lapor + pantau bug sendiri**: bug yang dilaporkan klien/timnya, dengan label status eksternal (`statusLabelFor` di `report-share.ts`).
- **Status rilis**: Kesiapan rilis versi eksternal (sama dengan PDF eksternal).
- **Dokumen**: dokumen yang berlaku, revisi yang menunggu, dan catatan perubahannya. Klien **hanya melihat dan berkomentar**; yang menyetujui tetap PO/Admin.

### F8. Test case dan test run sesuai standar QA (keputusan 2 Nov 2026)
Mockup: `23b`, `24a`, `24b` (menggantikan `24` untuk eksekusi). Nama, angka, dan tanggal di mockup adalah contoh.
Kondisi kode sebelum Step #10 (kolom `Bug.testRunItemId` sudah dihapus di migrasi `20261111090000`): `TestRunItem` hanya menyimpan hasil terakhir (re-run menimpa), test run membaca test case langsung dari repository (edit ikut berubah tanpa jejak), satu item hanya bisa punya satu bug (`Bug.testRunItemId` unik), dan test case tidak punya versi atau status.

**Repository test case**
- Status `DRAFT` / `READY` / `DEPRECATED`. Hanya `READY` yang bisa dimasukkan ke run. `DEPRECATED` disembunyikan dari daftar default, riwayat tetap ada.
- Versi: setiap simpan perubahan membuat `TestCaseVersion` (salinan judul, prasyarat, langkah, hasil yang diharapkan, prioritas, tipe, peran, rujukan) dengan nomor versi, pengubah, waktu, dan **catatan perubahan wajib**. Bila test case berlabel "Perlu dicek ulang" (F2), menyimpan versi baru menghapus label itu.
- Halaman detail test case punya tab: Detail, **Riwayat eksekusi** (semua percobaan lintas run: tanggal, run, build, penguji, hasil, bug), **Versi** (daftar + perbedaan antar-versi), **Bug terkait** (semua bug yang pernah ditautkan, dengan status saat ini).

**Test run**
- Setiap item menyimpan `testCaseVersionId` (snapshot saat ditambahkan). Bila repository punya versi lebih baru: label "Ada versi baru (v3)" dan aksi "Perbarui" per item atau "Perbarui semua". Memperbarui item yang sudah punya percobaan mengembalikan statusnya ke "Belum dijalankan" dan menulis entri log "Diperbarui ke v3 oleh …".
- **Log percobaan**: model baru `TestRunAttempt` (item, hasil `PASS`/`FAIL`/`BLOCKED`, hasil aktual, catatan, build yang dites (default dari run, bisa diubah), penguji, waktu). Status item = percobaan terakhir. Tidak ada percobaan yang ditimpa atau dihapus.
- **Bukti wajib saat Gagal**: minimal satu screenshot atau link pada percobaan `FAIL` (validasi server). Opsional untuk hasil lain.
- **Penanggung jawab per item** (`assigneeId`) dan filter "Tugas saya".
- **Dilewati**: status item `SKIPPED` dengan alasan wajib.

**Bug dan re-run**
- Relasi banyak-ke-banyak `TestRunItemBug` (item, bug, percobaan saat ditautkan). Dari percobaan gagal: "Buat bug baru" (form lapor terisi, seperti sekarang) atau "Tautkan bug yang ada". Bug **tidak wajib** punya test case; tautan dibuat dari sisi test run/test case. Migrasikan `Bug.testRunItemId` yang ada ke tabel ini.
- Item yang gagal menampilkan chip bug beserta status bug saat ini (mis. `CRM-6 · Perlu verifikasi`).
- **Pemicu re-run**: saat bug terkait dipindah ke `READY_FOR_VERIFICATION` (dengan build perbaikan, F3), setiap item yang percobaan terakhirnya `FAIL`/`BLOCKED` dan menaut ke bug itu ditandai **"Perlu re-run di build X"**, dan penanggung jawab item (atau pembuat run) mendapat notifikasi di aplikasi. Label hilang setelah percobaan baru dicatat. Filter "Perlu re-run" di run dan di daftar test case.

**Menutup test run**
- Tidak bisa ditutup selama ada item "Belum dijalankan"; item harus dijalankan atau ditandai Dilewati dengan alasan.
- Saat ditutup: keputusan **Lolos / Lolos bersyarat / Gagal** + catatan, beserta ringkasan (jumlah per status, bug terbuka terkait, item perlu re-run). Bisa dibagikan sebagai PDF memakai pola `report-pdf.tsx`.

### F7. Masuk, admin, dan integrasi
Mockup: `60`–`65`.
- Login: Google saja di produksi (Credentials hanya dev/test seperti sekarang).
- Menunggu persetujuan: linimasa 3 langkah, tombol "Periksa lagi"; status Ditolak menampilkan alasan dari Admin.
- Admin persetujuan user: tab per status, project awal + peran wajib sebelum Setujui; email di luar domain kantor + peran Admin/QA/Developer meminta konfirmasi; Tolak wajib alasan.
- Buat project: kode 2–5 huruf (tidak bisa diubah), modul awal, undangan email + peran, target SLA per severity.
- Impor bug: tetap modal (aksi singkat), format Markdown sesuai template; pratinjau per baris Siap/Mirip/Error; bug masuk sebagai Draft.
- API & Swagger: daftar endpoint per grup, detail field/respons, contoh curl; tautan ke pengelolaan API key.

### F9. Agent QA lokal menjalankan test case lewat MCP/CLI (keputusan 3 Nov 2026, revisi)
Mockup: `90` (peta alur), `91` (test run dengan hasil dari agent + impor), `92` (test case Siap untuk agent), `93` (hubungkan agent: kunci pribadi + setup), `94` (sesi agent). Instruksi agent: `agent/bugboard-qa-runner.md`. **Bergantung pada F8** (versi test case, `TestRunAttempt`, `TestRunItemBug`).

Cara kerja di lapangan:
1. QA membuka CLI dan menjalankan agent (mis. **pi**) **di folder lokalnya sendiri**, bukan di repo BugBoard.
2. Agent membaca test case dari BugBoard lewat **MCP** (atau **CLI `bugboard`** bila agent tidak mendukung MCP).
3. Agent mengeksekusi dengan **tool milik QA** (Playwright, Chrome DevTools, framework yang sudah ada). BugBoard tidak tahu dan tidak mengatur tool-nya.
4. Agent mencatat hasil per test case ke test run dan melaporkan bug ke modul Bug.

Prinsip: **BugBoard hanya menyediakan test case dan menerima hasil, bukti, serta bug.** Akun uji, base URL, dan cara eksekusi ada di mesin QA (mis. `.env` dan `AGENTS.md` di folder pengujian).

Keputusan:
- Yang dicatat: **hasil per test case** (Lolos/Gagal/Terblokir) ke test run **plus bug** untuk yang gagal, tertaut ke item.
- Koneksi: **MCP** (`/api/mcp`, sudah ada) **dan CLI `bugboard`** di atas REST API yang sama.
- **Tidak ada vault akun uji dan tidak ada daftar base URL** di BugBoard. Yang disimpan hanya nama lingkungan dan build yang dilaporkan agent (teks).
- **Sumber akun uji = satu link per project** (Google Docs/Sheets, Excel online, Notion), plus link khusus Vendor opsional. Visibilitas dipilih per link (Internal saja / Internal + Vendor). Setiap link punya **penanggung jawab** (QA lead). BugBoard hanya menyimpan URL dan label; agent membuka link itu dengan akses QA sendiri (connector Notion/Google di agent, atau browser). BugBoard tidak pernah mengambil, membaca, atau menyimpan isi dokumen.
- Hasil agent **langsung berlaku** atas nama QA pemilik kunci, dengan label "via agent {nama}". Bug dari agent tetap **Draft** dan melewati triase. Tidak ada layar konfirmasi usulan.
- Test case: **langkah netral tool + data uji**, tanda **"Siap untuk agent"**. Tidak ada kolom mode, path, selector, atau alias akun.
- **Impor hasil framework** lewat CLI: JUnit XML dan Playwright JSON, dicocokkan dengan kode test case di nama test.
- **Bukti wajib saat Gagal** (file atau link), sama dengan aturan untuk manusia. Bukti per langkah tidak diwajibkan.
- **API key pribadi per QA** dengan preset "Agent QA"; bisa dicabut per orang.
- Agent **boleh membuat test run** dari filter.
- Saat gagal: agent **mencari bug mirip dulu**; tautkan + komentar bukti bila cocok, bila tidak buat Draft yang tertaut.

**Skema (di atas F8)**
- `TestCase.agentReady Boolean @default(false)` dan `testData Json?`. Langkah boleh memakai `{{nama}}` yang merujuk ke kunci di `testData`. Fungsi `agentReadiness(tc)` → `{ ready, missing[] }`: status `READY`, semua `{{…}}` ada di `testData`, tidak ada kunci bernama password/token/secret di `testData`, hasil yang diharapkan tidak kosong.
- `TestRunAttempt` tambah: `source HUMAN|AGENT|IMPORT`, `agentName String?` (mis. `pi`), `toolName String?` (dilaporkan agent, mis. `playwright`), `environment String?`, `agentSessionId String?`. `executedById` = pemilik API key.
- `ProjectResourceLink`: `projectId`, `kind` (`TEST_ACCOUNTS`), `audience` (`PRIMARY` | `VENDOR`; maks satu per audience), `label`, `url` (http/https, validasi seperti `bug-input.ts`), `visibility` (`INTERNAL` | `INTERNAL_AND_VENDOR`, hanya untuk PRIMARY), `ownerUserId` (penanggung jawab), `lastOkAt`, `lastOkByUserId`, `lastProblem` (`UNREACHABLE` | `ROLE_MISSING` | null), `lastProblemAt`. Dikelola Admin project (`95`). Vendor menerima link VENDOR bila ada, selain itu PRIMARY bila visibilitas mengizinkan. Client/Viewer tidak pernah. Perubahan dicatat di audit log.
- `TestRunItem` tambah: `runningByUserId?`, `runningAgentName?`, `runningSince?`, `heartbeatAt?`, `currentStep Int?`, `totalSteps Int?` (status berjalan, lihat "Indikator sedang dijalankan").
- `ApiKey` tambah `ownerUserId` (kunci pribadi) dan `preset` (`AGENT_QA` | `READ_ONLY` | `CUSTOM`). Kunci pribadi dibuat dari profil; Admin project bisa melihat dan mencabut semua kunci di project.
- `AgentRun` dipakai sebagai **sesi agent**: tambah `testRunId?`, `startedAt`, `finishedAt?`, `summary Json?`. Tidak perlu tabel aksi browser; log sesi = hasil, bukti, dan bug yang dikirim (`94`).

**Tool MCP baru / diubah** (scope di route)
| Tool | Scope | Isi |
|---|---|---|
| `start_session` | `testrun:execute` | `{ agentName, toolName?, workdir? }` → `sessionId`. Opsional tapi disarankan; mengelompokkan semua yang dikirim. |
| `list_test_resources` | `testrun:execute` | → `[{ label, url }]` sesuai peran pemilik kunci. Hanya link, tanpa isi. |
| `report_resource_status` | `testrun:execute` | `{ status: OK \| UNREACHABLE \| ROLE_MISSING, role? }`. OK mengisi `lastOkAt`; masalah mengirim notifikasi ke penanggung jawab (tipe `resource_problem`), maks 1 per jam per masalah. |
| `heartbeat` | `testrun:execute` | `{ itemId, step, totalSteps }`, dipanggil setiap langkah (≤ 30 detik). Memperpanjang lease dan memperbarui indikator. |
| `list_agent_test_cases` | `testcase:read` | Filter modul/prioritas/teks; hanya `READY` + `agentReady`; sertakan `missing[]` untuk yang belum lengkap bila diminta. |
| `get_test_case` (sudah ada, diperluas) | `testcase:read` | Tambah `version`, `testData`, langkah dengan `{{…}}` sudah diisi. |
| `create_test_run` | `testrun:create` | `{ name, environment, buildVersion, sprint?, testCaseCodes? , filter? }`. |
| `list_test_runs` / `get_test_run` | `testrun:execute` | Run aktif dan item beserta status terakhir. |
| `claim_next_item` / `start_item` | `testrun:execute` | Ambil item berikutnya, atau tandai item tertentu mulai dijalankan. **Wajib sebelum eksekusi** supaya indikator berjalan tampil dan dua QA/agent tidak mengerjakan item yang sama. Lease 15 menit, diperpanjang oleh `heartbeat`. |
| `record_result` | `testrun:execute` | `{ itemId \| (testRunId, testCaseCode), result, actualResult, failedStep?, blockedReason?, buildVersion, environment, toolName?, evidenceIds?, links?, sessionId? }`. `FAIL` wajib ≥1 bukti (file atau link) dan `failedStep`; `BLOCKED` wajib alasan. |
| `upload_evidence` | `evidence:upload` | `{ fileName, mimeType, base64 }` → `evidenceId`. Maks 10 MB per file (trace/video), PNG/JPEG/WEBP/MP4/ZIP/JSON/TXT. |
| `link_bug_to_item` | `bug:comment` | `{ itemId, bugKey, comment }`. |
| `create_bug_draft` (diperluas) | `bug:create` | Parameter `testRunItemId`: menaut otomatis, menyalin langkah sampai `failedStep`, melampirkan bukti percobaan terakhir. |
| `finish_session` | `testrun:execute` | `{ sessionId, summary }`. |

Transport MCP: tangani `notifications/initialized` (HTTP 202 tanpa body) dan `ping`; saat ini route membalas error -32601. Batas laju key preset `AGENT_QA` 120 panggilan/menit.

**REST API + CLI `bugboard`**
- Semua tool di atas juga tersedia sebagai REST di `/api/v1/projects/{key}/…` dengan API key yang sama; MCP dan REST memanggil fungsi layanan yang sama (`src/lib/agent-service.ts`).
- CLI (paket terpisah di `packages/cli`, Node, tanpa dependensi berat): `bugboard login` (simpan kunci di env/keychain), `tc list --ready`, `tc get TC-KTK-018`, `run create`, `run next --run 42`, `result record`, `result import <file> --run 42 [--format junit|playwright]`, `bug search`, `bug create`, `evidence upload`, `resources [--env]`. Output `--json` untuk dipakai agent.
- Impor: cocokkan `TC-[A-Z]+-\d+` di nama test; yang tidak cocok dilaporkan sebagai "dilewati"; percobaan dibuat dengan `source=IMPORT`. Bukti dari lampiran laporan diunggah bila ada.

**Indikator sedang dijalankan** (permintaan: seperti GitHub Actions)
- Saat item di-`claim`/`start_item` hingga `record_result`: ikon lingkaran berputar (kuning, 14 px) menggantikan glyph status, label "Agent pi" (nama agent), teks "{QA} via {agent} · langkah 3/5 · 1 m 12 d".
- Muncul di: daftar item test run (`91`), banner di header run "Agent pi (Ega) sedang menjalankan TC-022 · langkah 3 dari 5 · item 5 dari 8", filter "Berjalan", daftar test case (`23`) dan detail test case (`23b`), serta daftar test run (hitungan item berjalan).
- Tanpa `heartbeat` selama 2 menit → status **Terhenti** (ikon jeda abu-abu, "Detak terakhir 2 m lalu"); lease dilepas setelah 15 menit dan item kembali bisa diambil.
- Pembaruan: polling setiap 5 detik selama ada item berjalan di layar (cukup tanpa websocket); berhenti saat tab tidak terlihat.
- `prefers-reduced-motion`: ikon tidak berputar (lingkaran setengah statis) dan teks tetap ada; ikon punya `aria-label="Sedang dijalankan"`.

**UI**
- `95` (Pengaturan › Sumber akun uji): link utama, visibilitas, penanggung jawab, status "terakhir berhasil dibuka", link khusus Vendor opsional, contoh format dokumen (Lingkungan, Peran, Username, Password, Catatan).
- `92`: tanda "Siap untuk agent", data uji JSON, panel kesiapan. Daftar test case (`23`) mendapat label "Siap agent"/"Belum lengkap" dan filter.
- `93` (di Profil): kartu "Sumber akun uji project" (daftar link, Admin bisa mengatur di Pengaturan); buat kunci pribadi dengan preset, kunci tampil sekali, daftar kunci + cabut, contoh `.mcp.json` dan perintah CLI.
- `91`: item menampilkan label "via agent pi" atau "impor JUnit", nama QA, tool yang dilaporkan, bukti, bug. Filter "Via agent". Tidak ada tombol terima/tolak.
- `94`: sesi agent: urutan hasil dan bug yang dikirim, ringkasan.

**Urutan tugas**
1. F8 (prasyarat).
2. Skema F9 + `agentReadiness` + tes.
3. `agent-service.ts` + tool MCP + perbaikan transport + tes (scope, lease, bukti wajib saat Gagal, kunci dicabut ditolak).
4. REST `/api/v1` di atas layanan yang sama.
5. CLI + impor JUnit/Playwright + tes parser.
6. UI `92`, `93`, `91`, `94`, label di `23`.
7. Uji ujung ke ujung: jalankan agent di folder pengujian terpisah dengan `agent/bugboard-qa-runner.md` pada 3 test case (Lolos, Gagal + bug baru, Gagal + bug mirip), lalu impor satu laporan JUnit.

Catatan keamanan link akun uji: siapa pun yang membuka link bisa melihat password, jadi atur berbagi dokumen hanya ke tim pengujian, pakai akun khusus pengujian dengan hak minimum (bukan akun orang), dan rotasi berkala. Password tetap akan terbaca oleh agent saat login; aturan runner melarang menuliskannya di hasil, bug, atau balasan.

Catatan: kompatibilitas agent pi dengan MCP belum diverifikasi dari sini; bila pi tidak mendukung MCP secara bawaan, gunakan CLI `bugboard` dengan output `--json`.

### F10. Onboarding pengguna baru (keputusan 3 Nov 2026)
Mockup: `A0` (peta alur), `A1` (menunggu persetujuan + ajakan belajar), `A2` (pilih peran panduan), `A3` (halaman Panduan), `A4` (project Latihan + tur sorotan), `A5` (Pengaturan › Anggota: progres onboarding).

Keputusan:
- **Dua tahap.** Saat status `PENDING`: tombol "Mulai panduan" dan "Buka project Latihan" di halaman menunggu (`A1`). Setelah disetujui: checklist berlanjut di project asli, tur sorotan muncul saat halaman pertama kali dibuka.
- **Per peran**: QA, Developer, Vendor, Klien, PO/Admin. Saat `PENDING` pengguna memilih sendiri (`A2`); setelah disetujui, peran dari Admin menggantikan pilihan itu (pilihan hanya memengaruhi isi panduan, bukan hak akses).
- **Bentuk**: halaman Panduan (kartu fitur dengan video/GIF pendek, "kapan dipakai", "Coba di Latihan"), checklist langkah pertama, tur sorotan (coach mark, bisa dilewati), peta alur, kamus istilah.
- **Project Latihan** berisi data dummy, satu per pengguna, **bisa dipakai sejak `PENDING`**. Semua fitur bisa dicoba, bisa direset.
- Dibuka lagi lewat menu **Panduan** (bawah sidebar) dan tombol **?** di header.
- **Admin melihat progres** ringkas di Pengaturan › Anggota (`A5`) dan bisa mengirim pengingat (notifikasi di aplikasi).

Skema
- `Project.isSandbox Boolean @default(false)`, `sandboxOwnerId String?` (unik per pengguna). Kode project sandbox mis. `LATIHAN`; tidak muncul di "Semua project" milik orang lain, tidak ikut laporan, tren, AI chat lintas project, notifikasi, maupun API key/MCP.
- Pengguna `PENDING` hanya boleh mengakses project sandbox miliknya (izin di `authz.ts`; tes wajib: pengguna PENDING ditolak di project asli dan di project sandbox orang lain).
- Seed sandbox: fungsi `seedSandbox(userId)` membuat modul, ±6 bug (berbagai status), ±6 test case, 1 test run sebagian berjalan, 1 dokumen contoh. "Reset data" menghapus lalu memanggil seed lagi. Batasi ukuran unggahan di sandbox (mis. 2 MB) dan hapus sandbox pengguna yang ditolak atau tidak aktif 90 hari.
- `OnboardingProgress`: `userId`, `guideRole` (peran panduan), `completedSteps String[]`, `dismissedTours String[]`, `updatedAt`. Langkah ditandai selesai oleh aksi nyata (event), bukan klik "tandai selesai", mis. `sandbox.bug_created`, `sandbox.triage_done`, `sandbox.testrun_executed`, `video.watched:bug-flow`.
- Definisi checklist & tur per peran disimpan sebagai konfigurasi kode (`src/lib/onboarding.ts`) agar mudah diubah; Admin situs boleh mengubah teks di tahap berikutnya (belum sekarang).

UI
- `A1`: kartu kedua di halaman menunggu, tidak menggeser status persetujuan.
- `A2`: 5 kartu peran, tombol Lewati.
- `A3`: progres "3 / 6 langkah pertama", tab Untuk {peran} / Semua fitur / Peta alur / Kamus istilah; kartu fitur 3 kolom; panel kanan checklist + istilah. Video: elemen `<video>` dengan poster, teks transkrip singkat, tanpa autoplay; bila video belum ada, kartu tampil tanpa tombol putar.
- `A4`: pita ungu "Project Latihan" di semua halaman sandbox, tombol Reset data dan Kembali ke panduan; tur sorotan menyorot elemen nyata (fokus berpindah ke tooltip, Esc menutup, Tab di dalam tooltip, posisi mengikuti elemen).
- `A5`: kolom Onboarding (bar + "4/5") dan "Kirim pengingat".

Urutan tugas: skema + `authz` sandbox + tes → seed & reset → halaman Panduan + checklist + event → tur sorotan (komponen sendiri, tanpa pustaka berat) → `A1`/`A2` → `A5` → video (konten direkam terpisah; mulai dengan 3 alur: Siklus bug, Siklus test, Agent QA).

### F11. Laporan performa per peran (keputusan 3 Nov 2026)
Mockup: `B0` (peta: siapa melihat apa), `B1` (Performa saya · QA), `B2` (Performa saya · Developer/Vendor), `B3` (Performa tim · lead), `B4` (PDF per orang, A4), `B5` (portal klien: performa tim agregat). Tab "Performa" di halaman Laporan, di samping Kesiapan rilis dan Tren. Angka di mockup adalah contoh.

Keputusan
- Dipakai untuk **refleksi diri + 1:1, penilaian kinerja (KPI), dan kesehatan tim**.
- Akses: **diri sendiri + Admin project (lead)**. Sesama anggota tidak saling melihat. **Klien hanya melihat ringkasan tim agregat tanpa nama** di portal (`B5`). Viewer tidak melihat performa.
- **Tanpa peringkat antar orang**: daftar tim diurut nama, tidak bisa diurutkan per metrik. Pembanding hanya periode sebelumnya (orang yang sama) dan **median tim per peran** di project.
- **Definisi metrik terlihat** lewat ikon (i) di setiap angka, dan ringkas di PDF.
- **Catatan konteks lead** per orang per periode, terlihat oleh orang itu, ikut di PDF.
- **Kerja via agent dan impor dihitung terpisah** dari manual.
- Periode: **sprint, bulan, kuartal**, dengan pembanding periode sebelumnya. **PDF per orang** (satu halaman A4).

Metrik (semua dihitung dari data yang ada + F1/F3/F4/F8/F9; tidak ada input manual)
- **QA**: test case dibuat, versi baru dibuat (per modul); percobaan dijalankan (manual / via agent / impor); cakupan test case Siap yang dijalankan ≥1× di periode; item Perlu re-run yang ditutup; bug dilaporkan; % diterima triase (bukan `INVALID`/`DUPLICATE`/`CANNOT_REPRODUCE`); sebaran severity; bug "lolos ke klien" (bug dilaporkan peran Client di modul yang test case-nya dijalankan orang itu di periode yang sama); bug diverifikasi/ditutup; median waktu respons triase Draft (dari `createdAt` sampai `reviewedAt`, hanya bila orang itu yang mereview); reopen setelah ia tutup.
- **Developer/Vendor** (berdasarkan assignee saat transisi): bug ke `READY_FOR_VERIFICATION` dan `CLOSED` per severity; % build perbaikan diisi; median waktu ditugaskan → Perlu verifikasi (dari `AuditLog`); % memenuhi tenggat (F4); tenggat diubah; reopen rate (bug yang `REOPENED` setelah ia pindahkan ke Perlu verifikasi ÷ total yang ia pindahkan); rata-rata percobaan re-run sampai lolos; beban saat ini (bug aktif, lewat tenggat).
- **PO/Admin** (ringan): revisi dokumen disetujui + median waktu persetujuan (F2); sprint ditutup tepat waktu (F1); bug Draft menunggu triase > 2 hari.
- **Tim/Klien (agregat)**: bug diselesaikan, median waktu perbaikan (per severity), % tenggat terpenuhi, reopen rate tim, bug dari tim klien yang diselesaikan, bug masuk vs selesai per sprint.

Implementasi
- `src/lib/performance.ts`: fungsi murni per metrik dengan input rentang waktu + `userId`/`projectId`, menghitung dari `AuditLog` (`bug.status_change`, `bug.review`), `Bug`, `TestCaseVersion`, `TestRunAttempt`, `Sprint`. Tes unit per metrik dengan data contoh (termasuk kasus Invalid tidak dihitung, agent dipisah, reopen).
- Teks definisi tiap metrik disimpan bersama fungsinya (satu sumber untuk tooltip (i) dan PDF).
- Model `PerformanceNote`: `projectId`, `userId`, `periodType`, `periodKey`, `body`, `authorId`, `updatedAt`. Hanya Admin project yang menulis.
- Cache: hitung saat dibuka; bila lambat, simpan ringkasan per sprint saat sprint ditutup.
- Hak akses di server: endpoint performa orang lain → 404 kecuali Admin project; endpoint portal hanya mengembalikan agregat.
- PDF: pola `src/lib/report-pdf.tsx`, satu halaman, footer "Dokumen internal".

### F12. Laporan › Ringkasan: grafik (keputusan 3 Nov 2026)
Mockup: `C1` (satu halaman panjang, 1366 lebar). Tab baru **Ringkasan** di Laporan: Ringkasan · Kesiapan rilis · Tren · Performa. Angka contoh.

Grafik (urutan di halaman)
1. **Distribusi status bug**: bar horizontal, satu warna, urut alur status; `INVALID`/`DUPLICATE`/`CANNOT_REPRODUCE`/`WONT_FIX` digabung "Ditolak" (catatan kaki).
2. **Bug per severity**: kolom, satu warna.
3. **Passed vs Open per modul**: bar horizontal berkelompok. **Passed = bug `CLOSED`; Open = bug aktif** (`OPEN`, `IN_PROGRESS`, `READY_FOR_VERIFICATION`, `REOPENED`). Draft tidak dihitung.
4. **Bug terbuka × status**: kolom bertumpuk per severity (ramp biru satu hue, Low terang → Blocker gelap).
5. **Open vs Passed per prioritas bug** (Urgent/High/Normal/Low): kolom berkelompok.
6. **Tren bug ditemukan**: garis + area tipis, per minggu/bulan/sprint mengikuti pengelompokan.
7. **Umur bug terbuka**: kolom bertumpuk per severity, ember < 3, 3–7, 7–14, > 14 hari.
8. **Burn-down sprint**: garis "Sisa" (bug + item test run terbuka) vs garis "Ideal" abu-abu.
9. **Workload developer & vendor** (bug aktif per orang, bertumpuk per severity, termasuk "Belum ditugaskan") dan **Workload tester** (item test run belum dijalankan + Draft untuk triase; kerja agent di baris terpisah). **Hanya terlihat oleh Admin project (lead)**; urut nama, tanpa peringkat (konsisten dengan F11).
10. **Progres eksekusi test run**: bar bertumpuk per run, warna status (Lolos/Gagal/Terblokir/Belum) **selalu dengan ikon + label** di legenda.

Filter & interaksi
- Bar filter global di atas semua grafik: periode (Sprint / Bulan / Kuartal), **kelompokkan per modul / bulan / sprint**, modul, versi rilis, lingkungan. Mengubah filter tidak mengubah warna seri yang tersisa.
- **Klik batang/titik** membuka daftar bug (atau test run) dengan filter yang sama (query string), mis. `?module=Kontak&state=active`.
- Hover: tooltip per batang (nilai + "klik untuk membuka daftar"); pada garis: crosshair + tooltip.
- Setiap grafik: tombol **"Lihat sebagai tabel"** (aksesibilitas + ekspor CSV) dan **pin "Masukkan ke PDF"** → grafik yang dipin ikut di PDF Rekap periode (`32`/`33`).
- Empat kartu angka di atas: bug aktif, Closed di periode, lewat tenggat, reopen rate (dengan selisih periode lalu).

Aturan visual (skill dataviz, dicek dengan validator palet)
- Palet kategori (urutan tetap, tidak pernah diputar): biru `#2a78d6` (Open/seri 1), oranye `#eb6834` (Passed/seri 2). Ramp severity: `#86b6ef`, `#5598e7`, `#256abf`, `#104281`. Status test: `#0ca30c`, `#d03b3b`, `#fab219`, abu `#c9c2b5`. Palet lulus validator (CVD & normal vision); beberapa warna di bawah 3:1 terhadap latar, jadi label langsung + tabel wajib ada.
- Batang ≤ 24 px, ujung data membulat 4 px, celah 2 px antar segmen; garis 2 px; grid 1 px solid samar; tanpa sumbu ganda; legenda selalu ada untuk ≥ 2 seri; teks nilai memakai warna teks, bukan warna seri.
- Mode gelap: langkah warna gelap dari palet yang sama (lihat `dataviz` palette reference), divalidasi terhadap latar gelap.
- Implementasi: SVG ringan atau pustaka chart kecil; data dari endpoint agregat `/api/projects/[key]/reports/summary?…` yang menghitung di database (group by), bukan di klien.

### F13. Navigasi: rail ikon + menu ☰ ala sidebar Cloudflare (keputusan 3 Nov 2026)
Mockup: `D1` (rail ikon, default), `D2` (laci menu terbuka sebagai overlay), `D3` (menu disematkan, konten bergeser). Menggantikan bagian navigasi di T1.

Perilaku
- **Default di desktop**: rail ikon 64 px selalu terlihat (☰ di atas, logo project, Bug, Sprint, Test case, Dokumen, Laporan, AI Chat, Pengaturan di bawah). Hover/fokus ikon → tooltip label + pintasan.
- **☰ atau tombol `[`** membuka laci berlabel 264 px **di atas konten** dengan latar redup (`D2`). Tutup: ☰, `[`, Esc, klik di luar, atau setelah memilih item. Saat terbuka fokus pindah ke item aktif; saat tertutup fokus kembali ke ☰ (`aria-expanded`, `aria-controls`).
- **Sematkan** (ikon pin di kepala laci): laci tetap terbuka dan konten bergeser (`D3`), seperti sidebar terbuka di Cloudflare. "Ciutkan ke ikon" kembali ke rail.
- Keadaan (rail / disematkan) dan grup yang dilipat **diingat per perangkat** (`localStorage`, sama seperti tema), tanpa kedip saat muat.
- Di layar < 1024 px rail disembunyikan; hanya ☰ di header yang membuka laci.

Isi laci
- Kepala: ☰, logo + nama project + peran, tombol sematkan.
- **Kerja** (bisa dilipat): Bug (badge jumlah Draft, merah), Sprint, Test case (badge "n berjalan" bila ada item yang dijalankan agent), Dokumen bisnis (badge versi menunggu).
- **Insight** (bisa dilipat): Ringkasan, Kesiapan rilis, Tren, Performa (sub-item di bawah Laporan); AI Chat.
- **Umum**: Semua project, Notifikasi (badge belum dibaca), Panduan (progres onboarding), API & Swagger, Pengaturan project; Persetujuan user hanya untuk admin situs.
- Kaki: profil + tema, "Ciutkan ke ikon".
- Item mengikuti hak akses (mis. Klien tidak melihat Test case/AI Chat; portal klien tetap memakai navigasi atas `70`).

Pintasan keyboard (tidak aktif saat fokus di input/textarea)
- `[` buka/tutup menu · `G` lalu `B` Bug, `S` Sprint, `T` Test case, `D` Dokumen, `A` AI Chat, `P` Semua project, `N` Notifikasi, `,` Pengaturan · `?` Panduan & daftar pintasan.

### F14. Dokumen & STLC agile (keputusan 3 Nov 2026)
Mockup: `E0` (peta STLC di BugBoard), `E1` (RTM), `E2` (Test Plan), `E3` (Test Summary Report otomatis), `E4` (Release notes), `E5` (status requirement + Definition of Ready), `E6` (tutup sprint dengan Definition of Done). Melengkapi F2.

Penilaian awal (sebelum F14): F2 sudah memenuhi praktik umum untuk **manajemen requirement** (versi, catatan perubahan, persetujuan, analisis dampak), tetapi belum menutup STLC: tidak ada Test Plan, tidak ada matriks keterlacakan (RTM), tidak ada status per requirement, dan tidak ada laporan penutupan/release notes.

Keputusan
- Modul **Dokumen** dikelompokkan: **Requirement** (PRD, seperti F2), **Rencana uji** (Test Plan), **Laporan uji** (Test Summary Report), **Release notes**, dan **Analisis › RTM**.
- **RTM otomatis** (`E1`): per bagian dokumen (§) → status requirement → jumlah test case → hasil terakhir → bug terbuka → status cakupan (Terverifikasi / Gagal / Belum diuji / Tanpa test case / Perlu dicek ulang). Kartu: cakupan requirement %, terverifikasi, gagal, tanpa test case. Ekspor CSV/PDF (dengan versi dokumen dan waktu cetak).
- **Status requirement per §**: Disetujui → **Siap dikembangkan** (lolos DoR) → Di sprint (otomatis saat dikaitkan ke sprint) → Selesai dikembangkan (ditandai PO/dev) → Terverifikasi (otomatis: semua test case § lolos di percobaan terakhir dan tidak ada bug terbuka). Revisi yang mengubah § mengembalikan statusnya ke Disetujui.
- **Definition of Ready** (`E5`): versi disetujui, kriteria penerimaan terisi (daftar per §), modul terdampak ditandai, minimal 1 test case merujuk §. Tombol "Tandai Siap dikembangkan" nonaktif sampai lengkap, dengan tautan ke langkah yang kurang.
- **Test Plan** (`E2`) per rilis: template Ruang lingkup, Pendekatan, Lingkungan & data (tautan sumber akun uji), Kriteria masuk/keluar, Risiko, Jadwal & peran; disetujui PO/Admin seperti PRD; sumber bisa ditulis di BugBoard, Word, atau Notion. Kriteria keluar ditampilkan dengan status saat ini (informatif, **tidak memblokir rilis**) dan juga muncul di Kesiapan rilis.
- **Test Summary Report** (`E3`): dibuat otomatis saat sprint/rilis ditutup dari test run, percobaan, bug, RTM, dan Test Plan; bagian otomatis ditandai; bagian teks bebas (penyimpangan, rekomendasi) diisi QA lead; "Finalkan" membekukan angka (snapshot) dan menghasilkan PDF.
- **Release notes** (`E4`) per versi: dari bug Closed dan revisi requirement di versi itu; mode Internal (ID, severity, penanggung jawab) dan Eksternal (judul ditulis ulang untuk pengguna, tanpa nama/catatan internal/Draft/Invalid); bagikan sebagai PDF; versi eksternal tampil di portal klien.
- **Definition of Done sprint** (`E6`): checklist (Blocker ditutup, High ditutup atau dipindah beralasan, test run ditutup dengan keputusan, requirement sprint Terverifikasi, Test Summary dibuat). Sprint bisa ditutup bila semua hijau, atau **dengan pengecualian beralasan** (wajib, tercatat di audit log dan Test Summary). Isi DoD diatur Admin di Pengaturan › Sprint.

Skema
- `BusinessDoc.kind`: `REQUIREMENT` | `TEST_PLAN` | `TEST_SUMMARY` | `RELEASE_NOTES`; relasi opsional ke `Sprint`/versi rilis.
- `RequirementSection` (dari F2) tambah: `status`, `readyAt`, `devDoneAt`, `devDoneById`, `acceptanceCriteria String[]`, `modules`.
- `TestSummary` snapshot: `docVersionId`, `data Json` (angka dibekukan), `finalizedAt`, `finalizedById`.
- `SprintDoDItem` (konfigurasi per project) dan `SprintClosure`: hasil checklist + `exceptionReason`.
- RTM dihitung dari `RequirementSection` ↔ rujukan test case/bug ↔ percobaan terakhir; tidak disimpan, dihitung saat dibuka (cache per versi dokumen bila perlu).

## Review QA lead (keputusan 3 Nov 2026)

Hasil review seluruh canvas. Yang diputuskan:

1. **Board v2 diganti v3.** `12`, `13`, `14` pindah ke halaman Arsip di canvas. Acuan barunya `G1`, `G3`, `G4`.
2. **Satu kamus status** (`G6`). Setiap layar, PDF, notifikasi, dan respons MCP memakai label dari satu modul. Label portal klien dibedakan dari label internal.
3. **Satu matriks hak akses** (`G6`) yang juga menjadi sumber tes terparameter (AC-PERM-02).
4. **Pola state wajib** (`G7`) untuk setiap daftar dan halaman baru.
5. **Proses QA yang ditambahkan:**
   - Panduan severity × prioritas saat melapor (`G3`).
   - Gabung duplikat (`G2`).
   - Retest langsung dari detail bug (`G1`).
   - Aturan notifikasi per jenis (`G5`), supaya hasil agent dan impor tidak membanjiri lonceng.
6. **MVP = inti QA.** Urutan, dependensi, dan skema ada di `ROADMAP.md`. Kriteria terima ada di `acceptance/`.
7. **Satu dataset cerita** (`dataset.md`): dipakai untuk board baru, seed sandbox onboarding (F10), dan e2e.

## Keputusan siap development (3 Nov 2026)

Semua keputusan terbuka sudah dijawab. Tidak ada lagi yang menghalangi MVP.

| Topik | Keputusan |
|---|---|
| Penyimpanan bukti test run | Disk server, sama dengan `BugAttachment`, batas 20 MB per file. Video dan trace yang lebih besar dikirim sebagai link (Loom, Drive). |
| Indikator agent berjalan | Polling 5 detik, hanya saat ada item berstatus lease aktif. Tanpa SSE. |
| Lease item | Agent heartbeat ≤ 30 detik. Item jadi "Terputus" dan bisa diklaim lagi setelah 90 detik tanpa heartbeat. |
| Mode fokus | Notifikasi ditahan, kecuali sebutan @nama yang tetap masuk. |
| CLI `bugboard` | Di repo `packages/cli`, dijalankan via `npx`/`npm link`. Tidak dipublikasikan ke npm. |
| Sesi agent | Perluas model `AgentRun` yang ada (status, toolName, workdir, startedAt, finishedAt, summary Json). Tidak membuat `AgentSession`. |
| Ringkasan "Hari ini" (T2) | Tampil untuk QA, Admin, Developer, dan Vendor. Disembunyikan untuk Klien dan Viewer. |
| Project uji (T8) | Kolom `Project.isTest Boolean @default(false)`, diset oleh seed e2e dan sandbox onboarding. Di Semua project, project ini dilipat ke grup "Project uji". |
| Tutup sprint (Fase 2) | Dialog menampilkan sisa bug dan item, default "pindah ke sprint berikutnya", per item bisa diubah jadi "kembalikan ke backlog". Hasilnya tercatat di Test Summary. |
| Test otomatis | Playwright untuk e2e. Nama test = ID AC, mis. `AC-BUG-05 lolos verifikasi`. Seed dari `dataset.json` dengan `isTest = true`. Vitest untuk unit tes izin, kamus, dan migrasi. |
| Dataset di board lama | Diselaraskan saat layarnya masuk fase implementasi. Implementasi selalu mengambil angka dari seed, bukan dari board. |
