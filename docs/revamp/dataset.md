# Dataset cerita: "CRM Sismedika · Sprint 14"

Satu cerita data untuk tiga keperluan:

1. **Board dan mockup baru.** Angka dan nama di layar diambil dari sini.
2. **Seed sandbox onboarding (F10).** Isi project Latihan = dataset ini, dengan nama project "Latihan · CRM".
3. **Data uji e2e.** Playwright/Vitest memakai seed yang sama, jadi skenario di `acceptance/` bisa dijalankan apa adanya.

Versi yang bisa dibaca mesin ada di `dataset.json`. Bila keduanya berbeda, yang benar adalah `dataset.json`.

## Project dan orang

- **Project:** CRM Sismedika, kode `CRM`
- **Modul:** Kontak, Leads, Laporan, Integrasi WA
- **Zona waktu:** WIB

| Nama | Peran project | Catatan |
|---|---|---|
| Rina Aulia | ADMIN (QA lead / PO) | Menyetujui revisi, menggabungkan duplikat |
| Ega | QA | Menjalankan agent pi di folder lokal |
| Dimas | DEVELOPER | Assignee CRM-6 |
| Sari | VENDOR (PT Mitra Kode) | Assignee CRM-9 |
| Putri | CLIENT | Pelapor CRM-24 lewat portal |
| Bayu | VIEWER | Manajemen, hanya melihat |

## Sprint, versi, dokumen

- **Sprint 14:** 20 Okt – 2 Nov 2026. Sprint 13 dipakai sebagai pembanding.
- **Rilis target:** 1.8.0, build terakhir di Staging `b214` (2 Nov 10.12). Build sebelumnya `1.7.9 · b209`.
- **Dokumen:** "PRD CRM" v5 (sumber Notion), bagian kritis `§4.2 Hak akses` (status Di sprint, belum Terverifikasi).
- **Test Plan 1.8.0:** target cakupan requirement 90%. Saat ini 88%.

## Bug kunci

| ID | Judul | Sev · Prio | Status | Build | Catatan |
|---|---|---|---|---|---|
| CRM-6 | Supervisor tidak bisa memindahkan pemilik kontak | High · Urgent | READY_FOR_VERIFICATION | ditemukan 1.7.9·b209, diperbaiki 1.8.0·b214 | Pelapor Ega via agent pi (30 Okt). Tenggat 1 Nov (lewat, SLA High 3 hari). §4.2. TC-018 Perlu re-run. CRM-21 dan CRM-23 digabung oleh Rina (31 Okt). Putri dan Sari tercatat sebagai pelapor tambahan. |
| CRM-9 | Template WA tidak terkirim ke nomor +62 8xx | High · High | READY_FOR_VERIFICATION | diperbaiki 1.8.0·b214 | Assignee Sari |
| CRM-21 | Pindah pemilik kontak gagal (Supervisor Utara) | High | DUPLICATE → CRM-6 | 1.7.9·b209 | — |
| CRM-23 | Tombol Simpan diam saat ganti pemilik | Medium | DUPLICATE → CRM-6 | 1.7.9·b209 | Pelapor Sari |
| CRM-24 | Pemilik kontak tidak bisa diganti | High | DRAFT | — | Pelapor Putri (Klien), 2 Nov. Contoh untuk dialog gabung `G2`. |

Kesiapan rilis 1.8.0: Blocker aktif 0, High aktif 2 (CRM-6, CRM-9). Verdict **Belum siap rilis**.

## Test

- **TC-018** "Supervisor memindahkan pemilik kontak" (modul Kontak, §4.2, Siap untuk agent, peran "Supervisor tim Utara").
- **Test run 1.8.0:** 3 run, 2 ditutup, 1 berjalan ("Regresi Leads").
- **Sesi agent pi (Ega), run "Regresi hak akses":** 8 hasil, terdiri dari 5 Lolos, 2 Gagal, dan 1 Terblokir. Dari situ muncul 1 bug baru (CRM-6) dan 1 bug ditautkan. Percobaan 1 TC-018 = Gagal di langkah 3, bukti `langkah-3.png` dan `trace.zip`.

## Board yang sudah memakai dataset ini

`G1`–`G7` (baris 15 dan versi v3 di baris 2 dan 5).

## Board yang belum diselaraskan

Board lain masih memakai angka contoh masing-masing, misalnya placeholder `[N]` di v2 dan angka grafik di `C1`/`B1`–`B5`. Saat diimplementasikan, jangan menyalin angka dari board itu. Ambil angka dari seed ini, atau dari data asli.
