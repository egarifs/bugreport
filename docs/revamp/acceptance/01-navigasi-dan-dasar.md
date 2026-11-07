# 01 · Navigasi, kamus status, hak akses, pola state

Mockup: `D1`–`D3`, `G6`, `G7`.

## Navigasi (F13)

**AC-NAV-01 · Laci terbuka dan tertutup**
- Diberikan: Ega di halaman Bug project CRM, rail 64px tampil.
- Ketika: Ega menekan ☰.
- Maka: laci terbuka di atas konten, fokus pindah ke item aktif. Esc atau klik di luar menutupnya dan fokus kembali ke ☰.

**AC-NAV-02 · Sematkan**
- Diberikan: laci terbuka.
- Ketika: Ega menekan "Sematkan".
- Maka: konten bergeser dan tidak tertutup laci. Setelah reload, laci masih tersemat (disimpan per pengguna).

**AC-NAV-03 · Menu sesuai peran**
- Diberikan: Putri (CLIENT) masuk.
- Maka: menu Test case, Test run, Agent, dan Pengaturan tidak tampil. Membuka URL `/projects/CRM/test-runs` langsung memberi state "tanpa akses" (`G7`), bukan error 500.

## Kamus status

**AC-DICT-01 · Satu sumber label**
- Diberikan: bug berstatus `READY_FOR_VERIFICATION`.
- Maka: label internal "Perlu verifikasi" dan label portal klien "Siap dicek" sama di daftar bug, detail, notifikasi, PDF, dan respons MCP (`statusLabel`). Ketiganya diambil dari satu modul kamus.

**AC-DICT-02 · Glyph selalu bersama label**
- Maka: tidak ada status yang ditampilkan hanya dengan warna atau hanya dengan glyph. Uji snapshot aksesibilitas tidak menemukan badge tanpa teks.

## Hak akses

**AC-PERM-01 · Server menolak di luar matriks**
- Diberikan: Sari (VENDOR).
- Ketika: Sari memanggil API verifikasi/tutup CRM-9.
- Maka: respons 403. Status bug tidak berubah, dan percobaan tercatat di audit log.

**AC-PERM-02 · Matriks = tes**
- Maka: untuk setiap sel matriks di `G6` ada satu tes terparameter (peran × aksi → boleh/tidak/terbatas).

## Pola state

**AC-STATE-01 · Kosong vs filter tanpa hasil**
- Diberikan: project baru tanpa bug → tampil "Belum ada bug" dengan aksi "Laporkan bug".
- Diberikan: filter Modul Laporan + Severity Blocker di CRM → tampil "Tidak ada bug yang cocok", daftar filter aktif, dan "Hapus semua filter".

**AC-STATE-02 · Gagal memuat**
- Diberikan: API daftar bug mengembalikan 500.
- Maka: tampil "Daftar bug gagal dimuat", tombol "Coba lagi", dan kode referensi. Draft form yang belum disimpan tidak hilang.

**AC-STATE-03 · Skeleton**
- Maka: skeleton baru muncul setelah 300 ms. Dengan `prefers-reduced-motion`, skeleton tanpa animasi.

**AC-STATE-04 · Data banyak**
- Diberikan: 1.240 bug.
- Maka: 50 per halaman, judul panjang dipotong dengan elipsis dan judul lengkap tersedia di `title`. Navigasi halaman bisa dipakai dengan keyboard.
