# 03 · Test case dan test run (F8)

Mockup: `23`, `23a`, `23b`, `24a`, `24b`.

**AC-TC-01 · Versi test case**
- Diberikan: TC-018 versi 2.
- Ketika: Ega mengubah langkah 3 dan menyimpan.
- Maka: tersimpan versi 3 dengan catatan perubahan. Tab Riwayat menampilkan v1–v3 dan perbedaannya.

**AC-TC-02 · Item run memakai versi saat ditambahkan**
- Diberikan: item TC-018 di run "Regresi hak akses" memakai v2.
- Ketika: v3 disimpan.
- Maka: item menampilkan "Ada versi baru". Tombol "Perbarui ke v3" hanya mengubah item yang belum punya percobaan, atau membuat percobaan baru. Percobaan lama tetap merujuk v2.

**AC-RUN-01 · Log percobaan**
- Ketika: TC-018 dijalankan dua kali (Gagal, lalu Lolos).
- Maka: item menampilkan 2 percobaan berurutan, masing-masing dengan hasil, build, lingkungan, pelaksana, "via agent" bila ada, waktu, dan bukti. Status item = hasil percobaan terakhir.

**AC-RUN-02 · Perlu re-run dari bug**
- Diberikan: TC-018 Gagal dan tertaut ke CRM-6.
- Ketika: CRM-6 masuk `READY_FOR_VERIFICATION`.
- Maka: item TC-018 ditandai "Perlu re-run" dengan tautan ke CRM-6. QA pemilik run mendapat notifikasi `rerun`.

**AC-RUN-03 · Banyak bug per item**
- Maka: satu item bisa ditautkan ke lebih dari satu bug, dan satu bug ke lebih dari satu item. Relasi lama `Bug.testRunItemId` termigrasi ke tabel join tanpa kehilangan data (tes migrasi pada seed).

**AC-RUN-04 · Status Dilewati**
- Ketika: item ditandai Dilewati.
- Maka: alasan wajib diisi. Item Dilewati tidak dihitung sebagai belum dijalankan saat menutup run.

**AC-RUN-05 · Tutup run**
- Diberikan: masih ada item Belum dijalankan.
- Ketika: QA menutup run.
- Maka: dialog meminta setiap item tersebut dijadikan Dilewati atau Terblokir, lalu meminta keputusan (Lolos / Lolos dengan catatan / Gagal) dan catatan. Run tertutup tidak menerima percobaan baru kecuali dibuka kembali oleh QA/Admin (tercatat di audit).
