# 02 · Siklus bug

Mockup: `10`, `11`, `G1`, `G2`, `G3`, `G5`.

## Laporkan bug v3 (`G3`)

**AC-BUG-01 · Peringatan duplikat saat mengetik**
- Diberikan: CRM-6 aktif.
- Ketika: Putri mengetik judul "Pemilik kontak tidak bisa diganti oleh Supervisor".
- Maka: dalam ≤ 1 detik setelah berhenti mengetik, muncul "Mirip CRM-6" dengan status dan tombol "Buka CRM-6". Form tetap bisa dikirim.

**AC-BUG-02 · Panduan severity**
- Maka: panel panduan menjelaskan 4 tingkat severity, beserta beda severity (dampak, diisi pelapor) dan prioritas (urutan, bisa diubah QA/PO saat triase).
- Ketika: pelapor CLIENT mengirim laporan.
- Maka: field Prioritas tidak tampil baginya, dan nilainya default `NORMAL`.

**AC-BUG-03 · Masuk sebagai Draft**
- Ketika: laporan dikirim.
- Maka: bug baru berstatus `DRAFT`, dengan build "Ditemukan di" = isian Build. Notifikasi `draft` dikirim ke QA sesuai preferensi mereka.

## Detail bug v3 (`G1`)

**AC-BUG-04 · Banner verifikasi**
- Diberikan: CRM-6 `READY_FOR_VERIFICATION` dengan diperbaiki di `1.8.0 · b214`.
- Maka: banner "Siap diverifikasi di build 1.8.0 · b214" tampil untuk QA/Admin dengan tombol "Lolos verifikasi" dan "Masih gagal…". Peran lain hanya melihat teks banner.

**AC-BUG-05 · Lolos verifikasi + retest**
- Ketika: Ega menekan "Lolos verifikasi".
- Maka:
  - Status jadi `CLOSED`, `verifiedInBuild = b214`, dan tercatat di aktivitas.
  - Karena TC-018 tertaut dan Perlu re-run, muncul tawaran "Catat percobaan Lolos untuk TC-018". Bila diterima, percobaan baru tercatat dan flag Perlu re-run hilang.
  - Toast "CRM-6 ditutup · Urungkan" tampil 6 detik.

**AC-BUG-06 · Masih gagal**
- Ketika: Ega menekan "Masih gagal…" tanpa alasan.
- Maka: tombol kirim nonaktif dengan pesan "Alasan wajib diisi".
- Ketika: alasan diisi.
- Maka: status jadi `REOPENED`, `reopenCount` bertambah 1, dan Dimas mendapat notifikasi.

**AC-BUG-07 · Tenggat lewat**
- Diberikan: tenggat 1 Nov dan hari ini 3 Nov.
- Maka: tenggat tampil "1 Nov · lewat" dengan teks (bukan hanya warna) dan info SLA "High 3 hari".

## Gabung duplikat (`G2`)

**AC-BUG-08 · Gabung**
- Diberikan: CRM-24 (Draft, pelapor Putri) dan CRM-6.
- Ketika: Rina memilih "Tandai duplikat dan gabungkan" ke CRM-6 dengan opsi default.
- Maka:
  - CRM-24 jadi `DUPLICATE` dengan `duplicateOfId = CRM-6`.
  - 2 komentar publik dan 1 bukti pindah ke CRM-6.
  - Putri tercatat di `BugCoReporter` dan menerima notifikasi status CRM-6.
  - Portal Putri menampilkan status CRM-6.

**AC-BUG-09 · Urungkan dalam 10 menit**
- Ketika: Rina menekan Urungkan dalam 10 menit.
- Maka: semua perpindahan dibatalkan dan CRM-24 kembali ke status sebelumnya. Setelah 10 menit, tombol Urungkan hilang.
- Maka: kedua aksi tercatat di audit log.

**AC-BUG-10 · Tidak bisa gabung ke diri sendiri atau berantai**
- Ketika: target gabung adalah bug yang sendiri berstatus `DUPLICATE`.
- Maka: sistem menawarkan bug induknya sebagai target.

## Preferensi notifikasi (`G5`)

**AC-NOTIF-01 · Ringkasan per sesi**
- Diberikan: Rina memilih "Ringkasan per sesi" untuk "Hasil dari agent / impor".
- Ketika: sesi agent pi Ega mengirim 8 hasil.
- Maka: Rina menerima tepat 1 notifikasi setelah sesi selesai: "Regresi hak akses · 8 hasil: 5 lolos, 2 gagal, 1 terblokir · 1 bug baru".

**AC-NOTIF-02 · Ringkasan harian**
- Diberikan: "Draft baru menunggu triase" = Ringkasan harian.
- Maka: draft yang masuk sepanjang hari dikirim sebagai satu notifikasi pukul 08.30 WIB keesokan hari.

**AC-NOTIF-03 · Cakupan "Hanya yang melibatkan saya"**
- Maka: notifikasi hanya dikirim untuk bug yang dilaporkan, ditugaskan, diikuti, atau menyebut pengguna.

**AC-NOTIF-04 · Mode fokus**
- Diberikan: mode fokus 2 jam aktif.
- Maka: lonceng tidak menambah badge selama 2 jam. Notifikasi tetap tersimpan dan muncul setelah fokus selesai. Sebutan @nama tetap masuk selama fokus (keputusan 3 Nov).
