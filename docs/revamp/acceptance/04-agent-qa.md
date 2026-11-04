# 04 · Agent QA lokal (F9)

Mockup: `90`–`95`. Instruksi agent: `../agent/bugboard-qa-runner.md`.

**AC-AG-01 · Kunci preset Agent QA**
- Ketika: Ega membuat kunci dengan preset Agent QA.
- Maka: kunci hanya tampil sekali dan memiliki scope baca test case, tulis hasil/bukti, dan buat bug Draft. Scope itu tidak mencakup ubah status bug atau pengaturan. Panggilan di luar scope dibalas error scope.

**AC-AG-02 · MCP siap untuk klien standar**
- Maka: CLI `packages/cli` (`npx bugboard … --json`) memanggil tool yang sama.
- Maka: route `/api/mcp` menjawab `initialize`, `notifications/initialized`, `ping`, dan `tools/list`. Uji kontrak dengan klien MCP referensi lolos.

**AC-AG-03 · Sumber akun uji hanya link**
- Diberikan: link "Akun uji Staging" (Notion) dengan visibilitas QA.
- Ketika: agent memanggil `list_test_resources`.
- Maka: yang dikembalikan hanya label, URL, lingkungan, dan penanggung jawab. Tidak ada field password di skema maupun di respons.
- Ketika: agent melapor `ROLE_MISSING` untuk "Supervisor tim Utara".
- Maka: pengaturan menampilkan peringatan ke penanggung jawab.

**AC-AG-04 · Klaim, lease, heartbeat**
- Ketika: agent memanggil `claim_next_item`.
- Maka: item TC-018 menampilkan spinner "Sedang dijalankan · pi (Ega) · langkah 1/3" di daftar run, dan peserta lain melihatnya tanpa reload (polling 5 detik, hanya saat ada lease aktif).
- Ketika: `heartbeat` dengan langkah 2.
- Maka: label menjadi langkah 2/3.
- Ketika: tidak ada heartbeat selama > 90 detik.
- Maka: lease kedaluwarsa, spinner berubah menjadi "Terputus", dan item bisa diklaim lagi.
- Maka: dua agent tidak bisa mengklaim item yang sama (uji konkurensi).

**AC-AG-05 · Hasil langsung atas nama QA**
- Ketika: `record_result` Gagal untuk TC-018 dengan `failedStep=3` dan dua bukti.
- Maka: percobaan baru tercatat dengan pelaksana Ega, label "via agent pi", dan `sessionId`. Hasil Gagal tanpa bukti ditolak dengan pesan jelas. File > 20 MB ditolak dengan saran mengirim link.

**AC-AG-06 · Bug selalu Draft dan dedupe**
- Ketika: `search_bugs` menemukan CRM-6 aktif dan agent memanggil `link_bug_to_item`.
- Maka: tidak ada bug baru. CRM-6 mendapat komentar berisi build, lingkungan, langkah gagal, dan nama file bukti.
- Ketika: `create_bug_draft`.
- Maka: bug berstatus `DRAFT`. Agent tidak bisa mengubah status bug.

**AC-AG-07 · Ringkasan sesi**
- Ketika: `finish_session`.
- Maka: `AgentRun` sesi berstatus selesai; halaman sesi menampilkan 8 hasil (5/2/1), 1 bug baru, dan 1 bug ditautkan. Notifikasi per sesi terkirim sesuai AC-NOTIF-01.

**AC-AG-08 · Keamanan** *(sebagian manual)*
- Maka: hasil, komentar, dan judul bug yang berisi pola rahasia (mis. `password=`, token berformat kunci) ditolak atau disamarkan di server. Rate limit 30/menit per kunci tetap berlaku. Kunci yang dicabut langsung menghentikan sesi.
