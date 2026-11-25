# BRD: Revamp BugBoard (QA, STLC, Performa, Onboarding)

Versi 1.0 · 25 Nov 2026 · Status dokumen: **Draf untuk review** (belum disetujui PO)
Sumber desain: canvas "Aplikasi" (±100 artboard) dan `docs/revamp/README.md` (F1–F14), `ROADMAP.md`, `acceptance/`.

## 1. Latar belakang dan tujuan

BugBoard dipakai tim QA, Developer, Vendor, Klien, dan PO/Admin untuk melapor, menelusuri, dan memverifikasi bug. Revamp memperluas produk dari "pelacak bug" menjadi alat QA yang menutup siklus uji (STLC agile) dan membantu tim bekerja lebih baik.

Tujuan bisnis:
1. Keterlacakan requirement → test case → hasil → bug, tanpa input manual ganda.
2. Keputusan rilis dan penutupan sprint berdasar bukti, dengan pengecualian yang tercatat.
3. Refleksi kinerja yang adil (tanpa peringkat antar orang).
4. Pengguna baru produktif lebih cepat lewat latihan aman.

Di luar lingkup dokumen ini: perubahan fitur MCP dan AI chat (sengaja tidak disentuh, belum didesain).

## 2. Pemangku kepentingan dan peran

| Peran | Kepentingan utama |
|---|---|
| QA / QA lead | Test case, test run, triase, Test Summary, RTM |
| Developer / Vendor | Mengerjakan bug, memenuhi tenggat, build perbaikan |
| PO / Admin project | Persetujuan dokumen, DoD sprint, performa tim, kesiapan rilis |
| Klien | Melapor bug, melihat status rilis dan release notes eksternal |
| Admin situs | Persetujuan pengguna, progres onboarding |

## 3. Status ringkas

Legenda: **Selesai** (dibangun, tes lulus), **Sebagian** (inti jalan, ada bagian belum), **Belum**.
"Terverifikasi" = sudah dicoba di browser pada lingkungan dev. **Semua item di bawah sudah ter-deploy ke production (commit `bea7940`, 25 Nov 2026) tetapi belum diperiksa di situs live.**

### 3.1 Sudah ada sebelum sesi ini (menurut ROADMAP)
Setup tes, navigasi rail, kamus status + izin, state kosong/error, triase, laporkan bug v3, detail bug v3, gabung duplikat, preferensi notifikasi, test case + versi, test run + percobaan, retest, agent QA lokal (F9), Sprint (F1), tenggat SLA (F4), Tren (F5), portal klien (F6), dokumen + persetujuan + diff (F2), login email/password, persetujuan user, impor bug, API Swagger. Status: **Selesai**.

### 3.2 Dikerjakan di sesi ini

| # | Fitur (rujukan desain) | Status | Terverifikasi | Catatan |
|---|---|---|---|---|
| 1 | F12 Laporan › Ringkasan: 10 grafik, 4 kartu, filter periode + modul, tabel alternatif | **Sebagian** | Ya | Lihat 4.1 |
| 2 | F14 RTM (`E1`): bagian requirement, cakupan, ekspor CSV | **Selesai** | Ya | Bagian dihasilkan dari heading dokumen |
| 3 | F14 Status requirement + Definition of Ready (`E5`) | **Selesai** | Ya | Status otomatis Di sprint / Terverifikasi |
| 4 | F14 Test Plan (`E2`) + panel kriteria keluar | **Sebagian** | Ya | Sumber hanya "tulis di BugBoard" |
| 5 | F14 Test Summary Report (`E3`): otomatis, finalkan = snapshot | **Sebagian** | Ya | PDF lewat cetak peramban |
| 6 | F14 Release notes (`E4`): internal/eksternal, portal klien | **Sebagian** | Ya | Tanpa "Perubahan fitur" dari revisi requirement |
| 7 | F14 Definition of Done sprint (`E6`): checklist, pengecualian beralasan, audit log, konfigurasi Admin | **Selesai** | Ya | Konfigurasi di halaman Sprint, bukan "Pengaturan › Sprint" |
| 8 | F14 Panel kriteria keluar di Kesiapan rilis (`G4`) | **Selesai** | Ya | Disembunyikan dari Klien |
| 9 | F11 Performa (`B1`–`B3`): QA, Developer/Vendor, PO/Admin, catatan lead, median tim per peran | **Sebagian** | Ya | Lihat 4.2 |
| 10 | F11 PDF per orang (`B4`) | **Sebagian** | Tidak (tata letak cetak) | Pakai dialog cetak peramban |
| 11 | F10 Project Latihan (sandbox): skema, akses PENDING, seed, reset, isolasi | **Selesai** | Ya | Tes akses wajib sudah ada |
| 12 | F10 Panduan: pilih peran, checklist dari aksi nyata, kamus, alur | **Selesai** | Ya | |
| 13 | F10 Halaman menunggu + kartu belajar (`A1`), pilih peran (`A2`) | **Selesai** | Ya | |
| 14 | F10 Progres onboarding admin + kirim pengingat (`A5`) | **Selesai** | Sebagian | Progres terbarui saat pengguna membuka Panduan |
| 15 | F10 Tur sorotan (`A4`) | **Selesai** | Ya | Satu tur: daftar bug Latihan |
| 16 | F10 Batas unggah 2 MB + hapus Latihan basi/ditolak | **Selesai** | Tes otomatis | Pembersihan berjalan saat Admin membuka halaman user |
| 17 | Cetak/simpan PDF (Test Plan, Summary, Release notes) | **Sebagian** | Tidak | Lihat 4.3 |
| 18 | Perbaikan tes: kunci project unik, hapus fixture tes | **Selesai** | Ya | 9 file tes dibersihkan |
| 19 | Migrasi DB (4 migrasi bernama) | **Selesai** | Ya | Diuji dari nol dan sebagai upgrade di DB sementara |
| 20 | Deploy production | **Selesai** | Healthcheck lulus | Cek manual di situs live belum dilakukan |

## 4. Yang belum selesai

### 4.1 F12 Ringkasan
- Tombol "Masukkan ke PDF" per grafik dan ekspor CSV per grafik.
- Grafik workload tester (item belum dijalankan + Draft untuk triase, kerja agent terpisah).
- Filter versi rilis dan lingkungan; pengelompokan per bulan/sprint; periode Bulan/Kuartal.
- Klik batang modul, prioritas, umur untuk membuka daftar tersaring.
- Burn-down belum menghitung item test run.
- Mode gelap untuk palet grafik; perhitungan memakai halaman, bukan endpoint agregat `/reports/summary`.

### 4.2 F11 Performa
- Periode "Sprint".
- Metrik butuh data yang belum dicatat: percobaan hasil impor, cakupan test case Siap, item re-run yang ditutup, bug "lolos ke klien".
- Tampilan agregat tim tanpa nama untuk Klien di portal (`B5`).
- "Bug dipindah ke Perlu verifikasi" dihitung berdasarkan pelaku perubahan status, bukan assignee saat itu.
- Metrik "revisi disetujui" menggabungkan setuju dan tolak.

### 4.3 Dokumen STLC dan PDF
- Test Plan: sumber Word dan Notion belum ada (ditunda, lihat 7).
- Release notes: bagian "Perubahan fitur" dari revisi requirement belum ada.
- Test Summary tidak mencantumkan alasan pengecualian penutupan sprint.
- DoD butir High belum memeriksa "dipindah dengan alasan" (hanya Closed atau tidak).
- PDF memakai cetak peramban (diputuskan cukup, lihat 7). Footer "Dokumen internal" ada.
- Sidebar Dokumen belum dikelompokkan seperti desain (hanya tautan dari halaman Dokumen).
- Status "Perlu dicek ulang" pada RTM belum mengikuti revisi requirement.

### 4.4 F10 Onboarding
- Video panduan (konten rekaman).
- Tur sorotan untuk halaman selain daftar bug.
- Project Latihan hanya berisi 1 test case (mengikuti `dataset.json`; spesifikasi menyebut ±6).
- Chat AI di Latihan tidak diatur khusus (pengguna aktif memakai data contoh mereka).

### 4.5 Operasional
- Verifikasi di situs live (halaman baru, login akun pending lewat Google).
- Database dev berisi ±1.065 project sisa tes; pembersihan menunggu persetujuan eksplisit (tindakan tak bisa dibatalkan).
- Dua file tes (yang membersihkan sebagian) dan tes vitest masih bisa menyisakan project.
- Belum ada tes end-to-end Playwright untuk halaman baru.
- Belum ada review kode oleh orang lain.

## 5. Kebutuhan non-fungsional yang dipenuhi
- Otorisasi di server pada setiap aksi baru; PENDING hanya akses Latihan miliknya (diuji).
- Perubahan skema lewat migrasi bernama; diuji dari nol dan upgrade; tanpa drift.
- Aksi penting tercatat di audit log (penutupan sprint, persetujuan, catatan performa, pengingat).
- Aksesibilitas dasar: label, ikon + teks untuk status, fokus tur, target sentuh ≥ 44 px.
- `npm run typecheck`, `npm test` (859 lulus), `npm run lint`, `npm run build` hijau pada commit yang di-deploy.

## 6. Risiko
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Fitur baru belum dicoba di production | Bug tak terlihat di dev (Google login, proxy) | Uji akun pending asli; rollback via `APP_TAG` |
| Pembersihan Latihan otomatis menghapus data | Pengguna kehilangan latihan | Hanya ditolak/ditangguhkan atau 90 hari tanpa aksi |
| Performa dipakai sebagai peringkat | Dampak budaya tim | Tanpa peringkat, definisi terlihat, pembanding periode lalu + median |
| RTM bergantung format heading dokumen | Bagian tidak terdeteksi untuk PDF | Dokumen non-Markdown menjadi satu bagian |

## 7. Keputusan PO (25 Nov 2026)
| # | Pertanyaan | Keputusan | Dampak |
|---|---|---|---|
| 1 | PDF Performa/Test Summary | Cukup cetak peramban | Item "A4 dirancang" dikeluarkan dari lingkup |
| 2 | Siapa melihat performa orang lain | Admin project itu saja (Admin situs tetap bisa) | Sesuai perilaku sekarang |
| 3 | Sumber Test Plan Word/Notion | Tidak wajib; tulis di BugBoard | Ditunda ke fase berikutnya |
| 4 | Agregat performa tim untuk Klien (`B5`) | Belum diputuskan | Tetap terbuka |
| 5 | Bersihkan DB dev (±1.065 project sisa tes) | Setuju, setelah backup | Menunggu dijalankan manual (tindakan tak bisa dibatalkan; perintah sempat diblokir) |

## 8. Kriteria penerimaan umum
- Setiap fitur berstatus Selesai memiliki tes otomatis untuk logika non-trivial dan lolos CI.
- Pengujian manual per peran (QA, Developer, Vendor, Klien, PO/Admin, Pending) di situs live tanpa bug P0/P1.
- Tidak ada perubahan pada fitur MCP dan AI chat.

## 9. Perbandingan aplikasi dengan desain (25 Nov 2026)

Metode: membandingkan teks/label tiap artboard dengan HTML halaman yang sama dari build lokal commit `bea7940` (identik dengan production), ditambah login production yang publik. Ini perbandingan **teks dan token**, bukan piksel; label yang hanya muncul pada kondisi tertentu (dialog, hover) bisa tampak "hilang". Halaman production yang butuh login tidak dibuka dengan kata sandi (kebijakan keamanan), jadi diverifikasi lewat build lokal.

| Area | Hasil |
|---|---|
| Login (production) | Sama untuk kalimat utama. Beda: judul merek "Bug Report by egarifs" vs desain "BugBoard Sismedika"; production juga menampilkan form email + kata sandi, desain hanya Google. |
| Font dan warna aksi | Sama (Atkinson Hyperlegible, aksi `#1E5AA8`). |
| Latar dan skala abu | **Beda**: aplikasi memakai abu dingin (`#F4F6F7`), desain krem hangat (`#F6F4EF`) dengan tekstur titik. |
| Semua project (`Projects`) | **Beda**: desain berupa tabel (Peran Anda, Bug aktif, Penghalang rilis, Menunggu review, Aktivitas terakhir), tab Saya anggota/Semua/Arsip, pencarian, pelipatan project uji. |
| Pengaturan project (`Settings`) | **Beda**: desain memakai tab "Umum dan anggota / Modul / Agent dan API key / Kuota AI Chat"; aplikasi masih satu halaman panjang. |
| Sprint | **Beda**: daftar sprint Berjalan/Berikutnya/Selesai di kiri, "Lihat tren", "Tutup sprint…", panel revisi dokumen belum seperti desain. |
| Dokumen bisnis | **Beda**: pembaca per bagian ("Bagian terpilih", "Dirujuk oleh", "Riwayat bagian ini", pencarian bagian) belum ada. |
| Kesiapan rilis | **Beda**: "Bagikan PDF", kartu Blocker/High aktif, "Cakupan requirement", tautan "Buka RTM" dan "Lihat release notes draf" belum ada di halaman ini. |
| Notifikasi | **Beda**: pengelompokan persetujuan per orang, "Tandai semua dibaca", "Pekerjaan Anda". |
| Triase (`TriageLight`) | Sebagian beda: perintah cepat, grup "Insight", pemilih Tema, kolom "Sumber", panel Triase dengan aksi cepat. Kerangka tampilan dan filter sudah ada. |
| Test case | Sebagian beda: "Tanpa modul", "Role pengguna", pemindahan modul massal, "Buat test run dari pilihan". |
| Laporkan bug | Hampir sama; beda: indikator "Draf tersimpan otomatis", kolom Lingkungan dan Requirement. |

Kesimpulan: fitur dan alur utama ada, tetapi **lapisan tampilan desain belum diterapkan penuh** (palet hangat, tab Pengaturan, tabel Semua project, grup notifikasi, pembaca dokumen per bagian, beberapa panel Kesiapan rilis). Ini perlu menjadi fase tersendiri ("penyelarasan visual").
