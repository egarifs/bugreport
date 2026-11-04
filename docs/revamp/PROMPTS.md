# Prompt untuk agent coding

Pakai prompt 1 sekali di awal sesi. Untuk setiap langkah berikutnya, pakai prompt 2 dan ganti `#N` dengan nomor langkah di `ROADMAP.md`. Kerjakan berurutan dari #0 sampai #12.

## 1. Prompt pembuka

```
Kamu agent coding untuk repo BugBoard (folder ini). Tugasmu mengimplementasikan revamp UI dan fitur baru dari paket desain di docs/revamp/.

Sebelum menulis kode:
1. Baca AGENTS.md, lalu docs/revamp/ROADMAP.md, docs/revamp/README.md (terutama "Aturan wajib", "Peta alur E2E", "Daftar layar", dan "Keputusan siap development"), dan docs/revamp/acceptance/README.md.
2. Periksa kondisi repo: package.json, prisma/schema.prisma, prisma/migrations/, src/lib/permissions.ts, src/lib/theme-tokens.cjs, tailwind.config.js.
3. Tulis rencana singkat untuk ROADMAP langkah #0 (setup Playwright + Vitest, kolom Project.isTest, seed dari docs/revamp/dataset.json): file yang diubah, migrasi, dan test. Tunggu persetujuan saya sebelum mulai.

Aturan kerja:
- Satu langkah ROADMAP = satu branch dan satu PR. Jangan mengerjakan langkah berikutnya tanpa diminta.
- Mockup (docs/revamp/mockups/*.html dan screenshots/*.png) adalah acuan layout, copy, dan interaksi. Warna selalu dari token Tailwind, bukan dari mockup. Mockup yang ditandai "digantikan" di README hanya riwayat.
- Angka dan nama contoh diambil dari dataset.json, bukan dari board.
- Perubahan skema = migrasi Prisma bernama (npx prisma migrate dev --name ...), bukan db push.
- Hak akses diperiksa di server, sesuai matriks di mockup G6.
- Jangan membaca, mencetak, atau meng-commit .env.
- Bila spesifikasi tidak jelas atau bertentangan dengan kode yang ada, tanyakan; jangan menebak.
```

## 2. Prompt per langkah

```
Kerjakan ROADMAP langkah #N di docs/revamp/ROADMAP.md.

1. Baca baris #N di ROADMAP, bagian T/F terkait di README, mockup dan screenshot yang disebut, serta file acceptance/ untuk langkah ini.
2. Buat branch revamp/step-N-<nama-singkat>.
3. Implementasikan, termasuk migrasi Prisma bila kolom "Skema" tidak kosong.
4. Tulis test: Playwright untuk setiap skenario AC di langkah ini (nama test diawali ID AC, mis. "AC-BUG-05 lolos verifikasi"), Vitest untuk logika izin, kamus status, dan migrasi data.
5. Jalankan lint, typecheck, unit test, dan e2e sampai lolos.
6. Cek layar di lebar 1366 dan 1920, terang dan gelap. Bandingkan dengan screenshot mockup dan sebutkan perbedaan yang disengaja.
7. Laporkan: apa yang dibuat, daftar AC lolos/gagal, migrasi yang dibuat, penyimpangan dari spesifikasi beserta alasannya, dan pertanyaan terbuka. Jangan merge; tunggu review saya.
```

## Catatan

- Langkah #10 (relasi bug ↔ item test run pindah ke tabel join) paling berisiko. Minta agent menunjukkan rencana migrasi dan uji migrasinya pada seed sebelum dijalankan.
- Setelah MVP (#0–#12) selesai dan dipakai satu sprint, minta kriteria terima Fase 2 ditulis dulu sebelum mulai coding.
