# Panduan Pindah ke Repository Publik Baru

Rencana migrasi satu arah dari repositori pengembangan privat ke repositori publik baru (misal `github.com/egarifs/bug-report` atau `github.com/egarifs/bugboard`).

Tujuan: Mempublikasikan seluruh kode sumber, pengujian, dan dokumentasi **tanpa membawa riwayat commit lama** yang pernah memuat alamat email pribadi dan nama organisasi internal.

---

## 1. Persiapan Sebelum Rilis

1. Buat repositori baru di GitHub melalui web (jangan centang "Add README", "Add .gitignore", atau "Choose a license"):
   - Nama repo saran: `bug-report`
   - Visibilitas: **Public**
2. Aktifkan fitur keamanan di GitHub repo baru:
   - **Settings → Code security and analysis**:
     - Aktifkan **Private vulnerability reporting** (sesuai target `SECURITY.md`).
     - Aktifkan **Secret scanning** dan **Push protection**.
     - Aktifkan **Dependabot alerts**.

---

## 2. Langkah Eksekusi (Opsi B1 - Clean Single Commit)

Jalankan perintah ini di terminal lokal Anda saat siap merilis:

```bash
# 1. Pastikan Anda berada di direktori induk
cd /home/ea/lab

# 2. Clone repo saat ini ke direktori baru
git clone bugreport bugreport-public
cd bugreport-public

# 3. Hapus seluruh git history lama
rm -rf .git

# 4. Inisialisasi git baru dengan branch main
git init -b main

# 5. Atur author menggunakan email noreply GitHub (mencegah email pribadi bocor)
git config user.name "egarifs"
git config user.email "68508709+egarifs@users.noreply.github.com"

# 6. Pastikan file rahasia (.env) dan folder uploads tidak terbawa
rm -f .env
rm -rf uploads/*

# 7. Verifikasi kebersihan sebelum commit awal
git status --short
# Pastikan tidak ada file .env atau uploads/

# 8. Buat initial commit yang bersih
git add -A
git commit -m "feat: initial open source release of Bug Report by egarifs (v0.1.0)"

# 9. Hubungkan ke GitHub repo publik baru dan push
git remote add origin git@github.com:egarifs/bug-report.git
git push -u origin main
```

---

## 3. Checklist Verifikasi Pasca-Push

- [ ] Halaman utama repo menampilkan `README.md` dengan badge MIT.
- [ ] Tab **Security** menampilkan kebijakan `SECURITY.md` dan form lapor kerentanan aktif.
- [ ] CI GitHub Actions berjalan otomatis dan seluruh job lulus (lint, typecheck, migrations, tests, build).
- [ ] Jalankan audit secret di repo publik:
  ```bash
  git grep -n -I -E 'AIza|gh[pousr]_|\bxox[baprs]-|BEGIN .*PRIVATE KEY|AKIA[0-9A-Z]{16}|br_live_[a-f0-9]{10,}'
  ```
  Harus tidak menghasilkan output selain string redaksi di `src/lib/redact.ts`.
- [ ] Rilis paket CLI ke npm (opsional):
  ```bash
  cd packages/cli
  npm login
  npm publish --access public
  ```

---

## 4. Repositori Privat Saat Ini

Repositori di folder `/home/ea/lab/bugreport` tetap disimpan sebagai arsip internal privat yang menyimpan sejarah penuh 120+ commit pengembangan.
