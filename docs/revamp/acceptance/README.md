# Kriteria terima MVP

Format: **Diberikan** (kondisi awal) / **Ketika** (aksi) / **Maka** (hasil yang bisa diperiksa). Data mengikuti seed `../dataset.md`. Setiap skenario diberi ID (mis. `AC-BUG-03`) agar bisa dirujuk dari test case BugBoard dan nama test e2e.

| File | Cakupan | Roadmap MVP |
|---|---|---|
| `01-navigasi-dan-dasar.md` | Rail + ☰, kamus status, hak akses, pola state | #1–#3 |
| `02-siklus-bug.md` | Laporkan v3, detail v3, verifikasi di build, gabung duplikat, notifikasi | #4–#8, #11 |
| `03-test-run.md` | Versi test case, percobaan, re-run, banyak bug, tutup run | #9–#10 |
| `04-agent-qa.md` | Kunci, sumber akun uji, MCP/CLI, lease, heartbeat, hasil, bug | #12 |

Test otomatis: Playwright (e2e, nama test diawali ID AC) dan Vitest (unit). Seed: `../dataset.json` sebagai project `isTest`.

Definisi selesai per PR:

- Semua skenario di file terkait lolos dan otomatis, kecuali yang ditandai *(manual)*.
- Layar dicek di lebar 1366 dan 1920, terang dan gelap.
- Teks layar sesuai kamus status (`G6`).
- Pemeriksaan hak akses dilakukan di server, bukan hanya dengan menyembunyikan tombol.
