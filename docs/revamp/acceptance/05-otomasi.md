# 05 · Otomasi dari test case: via agent dan via kode (F15)

Mockup: `H0`–`H6`. Spesifikasi: README › F15.

**AC-AUTO-01 · Status Siap diotomasi**
- Diberikan: TC-024 dengan langkah, hasil yang diharapkan, peran, dan lingkungan terisi, tanpa kode tertaut.
- Maka: status otomasi = Siap · via agent, dan TC-024 langsung bisa dijalankan.
- Ketika: hasil yang diharapkan dikosongkan.
- Maka: status kembali ke Manual; tombol Jalankan dan "Jadikan kode" nonaktif. Poin yang kurang tampil di panel kelengkapan.

**AC-AUTO-02 · Perintah jadikan kode**
- Ketika: Ega menekan "Jadikan kode" di TC-024.
- Maka: dua perintah tersalin: `npx bugboard tc plan TC-024 > specs/TC-024.md` dan `pi "generate dari specs/TC-024.md"`.
- Maka: plan yang diekspor berformat markdown planner Playwright, dengan langkah bernomor, data uji terisi, dan hasil yang diharapkan.
- Maka: MCP `get_test_case` untuk TC-024 mengembalikan langkah dengan data uji terisi, peran, dan lingkungan.
- Maka: tidak ada kode yang disimpan di BugBoard.

**AC-AUTO-03 · Tautan dari reporter**
- Ketika: reporter mengirim hasil untuk test `ekspor kontak ke CSV @TC-024` dari `tests/kontak/ekspor.spec.ts`.
- Maka: TC-024 menjadi Otomatis dan `H2` menampilkan repo, file, baris, judul test, dan commit.
- Ketika: reporter mengirim test tanpa tag `@TC-xxx`.
- Maka: test itu dilaporkan sebagai "tidak tertaut" dan tidak mengubah test case mana pun.

**AC-AUTO-04 · Test case berubah setelah kode dibuat**
- Diberikan: kode TC-018 dibuat dari v3.
- Ketika: TC-018 disimpan sebagai v4.
- Maka: `H2` menampilkan peringatan "Test case berubah (v3 → v4) setelah kode dibuat" dan tombol "Salin perintah perbarui".

**AC-AUTO-05 · Jalankan dari tab Otomasi**
- Diberikan: runner `ega-laptop` online, dan TC-019, TC-021, TC-024 dipilih.
- Ketika: Ega menekan Jalankan dengan Staging dan b214.
- Maka: terbentuk test run "Otomasi · Kontak · b214" berisi ketiganya: TC-019 via kode, TC-021 via agent (Perlu perbaikan), TC-024 via agent (belum ada kode). Bar pilihan menampilkan "1 via kode · 2 via agent".
- Maka: runner mengambil jalan itu dalam ≤ 10 detik.

**AC-AUTO-06 · Runner hanya menjalankan Playwright**
- Ketika: server mengirim tugas berisi argumen selain kode TC, lingkungan, build, dan browser (mis. `--config=/tmp/x` atau `; rm -rf`).
- Maka: runner menolak tugas, melaporkan error, dan tidak menjalankan apa pun.

**AC-AUTO-07 · Progres dan log**
- Saat jalan berlangsung:
  - Item TC-018 menampilkan spinner "Berjalan · langkah 2/3".
  - Bar progres menampilkan jumlah lolos/gagal/berjalan/antre.
  - Log runner diperbarui tiap 5 detik tanpa reload.
- Maka: dengan `prefers-reduced-motion`, spinner tidak berputar.
- Maka: log tidak memuat isi `.env` atau pola rahasia.

**AC-AUTO-08 · Hasil jadi percobaan**
- Ketika: TC-021 gagal.
- Maka: percobaan baru tercatat dengan sumber "otomasi", durasi, runner, build, trace, dan screenshot. Tidak ada bug yang dibuat.
- Maka: percobaan masuk antrean "Perlu ditinjau".

**AC-AUTO-09 · Triase: test rusak**
- Ketika: Ega memilih "Test rusak" untuk TC-021 dan menugaskan ke dirinya.
- Maka: TC-021 menjadi Perlu perbaikan dan keluar dari antrean.
- Maka: TC-021 tidak dihitung sebagai gagal di Kesiapan rilis, tetapi muncul di daftar "Otomasi perlu perbaikan".

**AC-AUTO-10 · Triase: bug produk**
- Ketika: Ega memilih "Bug produk" untuk TC-033.
- Maka: dialog cek duplikat muncul. Bug Draft baru terisi langkah dari TC, build, lingkungan, trace, dan screenshot, lalu ditautkan ke percobaan.

**AC-AUTO-11 · Triase: flaky**
- Ketika: Ega memilih "Flaky" lalu jalan ulang lolos.
- Maka: percobaan baru Lolos dengan label `flaky`, dan jumlah flaky bertambah di laporan.
- Ketika: jalan ulang gagal lagi.
- Maka: kegagalan kembali ke antrean dengan catatan "gagal konsisten".

**AC-AUTO-12 · Batalkan**
- Ketika: QA menekan Batalkan saat 2 item masih antre.
- Maka: proses di runner berhenti dalam ≤ 10 detik, dan 2 item itu menjadi Dilewati dengan alasan "dibatalkan".

**AC-AUTO-13 · Runner offline**
- Diberikan: tidak ada runner milik pengguna yang online.
- Maka: tombol Jalankan nonaktif dengan teks "Tidak ada runner online" dan tautan ke Profil › Runner otomasi.

**AC-AUTO-14 · Cek tag**
- Ketika: reporter mengirim satu test tanpa tag, satu bertag `@TC-999` yang tidak ada, dan satu bertag dua TC.
- Maka: ketiganya muncul sebagai peringatan di ringkasan test run dan di Profil › Runner, tidak dihitung sebagai hasil TC, dan jalan tetap selesai.

**AC-AUTO-15 · Hubungkan test lama**
- Ketika: `bugboard tests scan` mengirim 13 test tanpa tag.
- Maka: H6 mengelompokkan Cocok / Perlu ditinjau / Tidak cocok. Tidak ada tautan yang dibuat sebelum QA menekan "Tautkan".
- Ketika: satu test cocok dengan dua TC.
- Maka: test itu masuk Perlu ditinjau, bukan Cocok.
- Ketika: QA menautkan 2 test.
- Maka: `AutomationLink` tersimpan dan status TC menjadi Otomatis setelah hasil pertama dari reporter.

**AC-AUTO-16 · Perintah healer**
- Ketika: QA memilih "Test rusak" pada TC-021.
- Maka: tombol "Salin perintah healer" menyalin perintah untuk `@TC-021`. Bila agent melaporkan healer men-skip test, kegagalan ditandai "kemungkinan bug produk".

**AC-AUTO-17 · Jalankan via agent oleh user non-teknis**
- Diberikan: Putri (atau QA non-teknis) menulis TC baru yang lengkap; runner tim online; tidak ada kode untuk TC itu.
- Ketika: ia menekan Jalankan.
- Maka: runner menjalankan agent pi untuk TC itu tanpa langkah teknis apa pun. Item menampilkan spinner dan langkah aktif. Hasilnya dicatat dengan label "via agent", beserta screenshot.

**AC-AUTO-18 · Pilih cara di detail TC**
- Diberikan: TC-018 punya kode dari v3, sedangkan TC sudah v4.
- Maka: detail TC menampilkan tombol "Jalankan via agent" dan "Jalankan via kode".
- Ketika: "Jalankan via agent" ditekan.
- Maka: agent memakai langkah v4.

**AC-AUTO-19 · Sarankan jadikan kode**
- Diberikan: ambang diatur 3 jalan via agent per sprint.
- Ketika: TC-052 dijalankan via agent untuk ketiga kalinya di Sprint 14.
- Maka: H1 menampilkan label "Sarankan jadikan kode" pada TC-052.

**AC-AUTO-20 · Runner menolak perintah lain**
- Ketika: tugas via agent membawa argumen selain kode TC, lingkungan, build, dan browser.
- Maka: runner menolak tugas itu, sama seperti AC-AUTO-06.
