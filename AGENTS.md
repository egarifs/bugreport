# Petunjuk untuk agent coding (BugBoard / bugreport)

Revamp UI dan fitur baru dikerjakan dari paket desain di `docs/revamp/`. Jangan membuka canvas claude.ai; semua isinya sudah diekspor ke folder itu.

Urutan baca:
1. `docs/revamp/ROADMAP.md` — urutan kerja MVP (#0–#12), perubahan skema per langkah. Kerjakan berurutan, satu langkah = satu PR.
2. `docs/revamp/README.md` — aturan wajib (token warna, lebar penuh 1366, aksesibilitas), peta alur E2E, daftar layar → file repo, spesifikasi T1–T14 dan F1–F14, keputusan siap development.
3. `docs/revamp/acceptance/` — kriteria terima Diberikan/Ketika/Maka. Nama test Playwright diawali ID AC.
4. `docs/revamp/dataset.json` — seed tunggal (project `isTest`) untuk e2e dan sandbox onboarding.
5. `docs/revamp/mockups/*.html` dan `screenshots/*.png` — acuan layout, copy, dan interaksi (bukan acuan kode warna). Mockup yang ditandai "digantikan" di README hanya riwayat.

Aturan repo:
- Perubahan skema = migrasi Prisma bernama (`npx prisma migrate dev --name ...`), bukan `db push`.
- Jangan membaca, mencetak, atau meng-commit `.env`.
- Hak akses selalu diperiksa di server (`permissions.ts`), bukan hanya disembunyikan di UI.
- `docs/revamp/agent/bugboard-qa-runner.md` adalah instruksi untuk agent QA yang menjalankan test case, bukan untuk agent coding.
