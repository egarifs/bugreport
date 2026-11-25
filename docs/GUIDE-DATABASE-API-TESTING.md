# Guide: database, API, dan testing

Panduan untuk developer dan QA yang bekerja di repo ini. Semua perintah dijalankan dari root repo. Jangan menaruh password, API key, atau isi `.env` di dokumen, issue, atau chat.

## 1. Menjalankan lokal

```bash
cp .env.example .env                 # ganti semua placeholder
export POSTGRES_PASSWORD=<pilih-sendiri>
docker compose up -d                 # PostgreSQL 16 di 127.0.0.1:5434
npm ci
npx prisma migrate deploy
ENABLE_DEV_LOGIN=true npm run dev -- -p 3001
```

Login tanpa Google: buka `/login`, isi email, klik **Login Dev (Auto-create user)**. Tombol ini hanya ada kalau `ENABLE_DEV_LOGIN=true`. Email yang ada di `ADMIN_EMAILS` otomatis menjadi admin dan aktif.

Menjadikan sebuah email super admin di database lokal (idempotent, menolak `NODE_ENV=production`):

```bash
npx tsx scripts/dev-admin.ts nama@domain.com
```

## 2. Akses database

| Hal | Nilai |
|---|---|
| Host dan port | `127.0.0.1:5434` (hanya bisa dari mesin sendiri) |
| Database dev | `bugreport` |
| Database tes CI | `bugreport_test` |
| User | `bugreport` |
| Password | nilai `POSTGRES_PASSWORD` yang Anda set sendiri |
| Skema | `public`, definisi di `prisma/schema.prisma` |

Cara membuka:

```bash
# psql di dalam container (tidak perlu memasang psql)
docker exec -it bugreport-db psql -U bugreport -d bugreport

# GUI bawaan Prisma
npx prisma studio
```

Query yang sering berguna:

```sql
\dt                                              -- daftar tabel
select key, status, severity, title from "Bug" order by "createdAt" desc limit 20;
select status, count(*) from "Bug" group by status;
select "key", "bugSeq" from "Project";           -- bugSeq harus >= nomor bug tertinggi
select migration_name, finished_at from _prisma_migrations order by 1;
```

Aturan:
- Nama tabel dan kolom memakai tanda kutip dan huruf besar kecil persis seperti di skema (`"Bug"`, `"projectId"`).
- Ubah skema hanya lewat `prisma/schema.prisma` dan migrasi bernama (`npx prisma migrate dev --name <nama>`). Jangan `ALTER` manual di database bersama.
- Database dev lama bisa punya riwayat migrasi yang tidak cocok dengan folder `prisma/migrations` (sejak squash ke `baseline`). Kalau `migrate dev` menawarkan reset, jangan setuju sebelum mencadangkan data. Produksi aman, `deploy/deploy.sh` menanganinya.
- Grafik relasi: [database-erd.md](database-erd.md). Perbarui dengan `npx tsx scripts/gen-erd.ts` setelah mengubah skema.

## 3. Mengakses API

Ada dua jalur.

### 3.1 MCP / JSON-RPC untuk agent dan skrip

- Endpoint: `POST /api/mcp`
- Auth: header `Authorization: Bearer br_live_...`
- Buat API key di **Project, Pengaturan, tab "Agent dan API key"**. Key hanya tampil sekali. Simpan di password manager, jangan di repo.
- Scope umum: `bug:read`, `bug:create`, `bug:comment`, `testcase:read`, `testrun:execute`, `testrun:create`, `evidence:upload`.
- Batas: 30 panggilan per menit per key (120 untuk preset AGENT_QA).
- Spesifikasi lengkap: `GET /api/docs/openapi.json`, tampilan Swagger di `/api-docs`.

```bash
export BR_URL=http://localhost:3001
export BR_KEY=br_live_...           # jangan di-commit

# daftar tool
curl -s $BR_URL/api/mcp -H "Authorization: Bearer $BR_KEY" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# cari bug
curl -s $BR_URL/api/mcp -H "Authorization: Bearer $BR_KEY" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_bugs","arguments":{"query":"login"}}}'
```

Tool penting: `search_bugs`, `get_bug`, `create_bug_draft`, `add_bug_comment`, `search_test_cases`, `create_test_cases`, `create_test_run`, `claim_next_item`, `record_result`, `import_junit_results`. Daftar lengkap dan skema argumen: `tools/list`.

### 3.2 REST untuk UI

Endpoint di `src/app/api/**` dipakai UI dengan sesi login (bukan API key), antara lain `/api/projects/[key]/export`, `/rtm`, `/duplicates`, `/chat`, `/api/notifications`. Aksi tulis di UI memakai server action (`src/app/projects/[key]/*-actions.ts`) yang memeriksa sesi dan izin di server pada setiap panggilan.

## 4. Menjalankan tes

| Perintah | Isi | Catatan |
|---|---|---|
| `npm test` | tes Node (`src/lib/*.test.ts`) | memakai database di `DATABASE_URL` |
| `npm run test:unit` | Vitest | memakai database |
| `npx playwright test` | e2e | menyalakan dev server di port 3100 sendiri |
| `npm run typecheck` / `npm run lint` / `npm run build` | statis | wajib hijau sebelum push |

Aturan praktis:
- **Jangan menjalankan `npm run build` bersamaan dengan Playwright.** Keduanya memakai folder `.next`, sehingga e2e gagal dengan `ChunkLoadError`. Jalankan berurutan.
- Playwright sudah menyetel `ENABLE_DEV_LOGIN=true` dan `ADMIN_EMAILS` untuk server tesnya. User `step1-qa@example.test` otomatis admin.
- Tes yang butuh project memakai `createTestProject` dari `src/lib/test-project.ts`. Project uji dihapus otomatis saat proses selesai.
- Spec e2e yang menyisipkan bug langsung lewat Prisma harus menjaga `Project.bugSeq` tetap di depan nomor bug, kalau tidak pembuatan bug lewat form bentrok `key`.
- Tes mengikuti pola: satu `test(...)` per perilaku, tanpa mock database untuk logika yang menyentuh Prisma.

## 5. Membuat test case

Test case adalah catatan pengujian terstruktur yang disimpan di project. Kolom utama: `code` (unik per project, misal `TC-BOARD-001`), `title`, `module`, `priority` (CRITICAL, HIGH, MEDIUM, LOW), `testType`, `targetRole`, `precondition`, `steps`, `expectedResult`, `referenceUrl`.

Menulis test case yang baik:
- Satu skenario per test case, judul berupa kalimat hasil: "Drag kartu ke kolom yang tidak diizinkan ditolak".
- `precondition`: data dan role yang dibutuhkan, tanpa password atau token.
- `steps`: bernomor, satu aksi per baris.
- `expectedResult`: bisa diamati dan diverifikasi (teks, status, jumlah baris), bukan "berjalan baik".
- Sertakan kasus negatif dan batas (izin ditolak, input kosong, batas jumlah).

Tiga cara membuatnya:

1. **UI**: project, Test case, tambah. Perubahan membuat versi baru (riwayat tersimpan).
2. **MCP**: tool `create_test_cases`. Kalau `code` sudah ada, test case di-update (upsert).

   ```bash
   curl -s $BR_URL/api/mcp -H "Authorization: Bearer $BR_KEY" -H 'content-type: application/json' -d '{
     "jsonrpc":"2.0","id":3,"method":"tools/call",
     "params":{"name":"create_test_cases","arguments":{"testCases":[{
       "code":"TC-DEMO-001","title":"Filter severity menyaring daftar","module":"Filter",
       "priority":"HIGH","testType":"Functional","targetRole":"QA",
       "precondition":"Ada bug dengan severity High dan Low",
       "steps":"1) Buka halaman Bug\n2) Klik Filter, pilih Severity\n3) Centang High",
       "expectedResult":"Hanya bug High tampil dan chip \"Severity: High\" muncul"}]}}}'
   ```
3. **Seed dari repo**: data ada di `docs/testcases/bugreport.json`, dimuat oleh `prisma/seed-bugreport.ts` (lihat bagian 6). Cara ini cocok untuk test case yang ikut dikontrol versi bersama kode.

## 6. Project "bugreport" dan test case-nya

Test case untuk fitur halaman Bug (list, board, filter, tag, filter tersimpan, aksi massal, lapor, impor, triase) disimpan di repo dan bisa dimuat ke project **bugreport** (key `BGR`) di aplikasi.

```bash
npx tsx prisma/seed-bugreport.ts nama@domain.com   # email dijadikan admin project
```

Skrip aman dijalankan ulang: project dan modul dibuat kalau belum ada, test case di-upsert berdasarkan `code`. Ringkasan dalam bentuk tabel ada di [docs/testcases/bugreport.md](testcases/bugreport.md) (dibuat otomatis oleh skrip yang sama).

Alur kerja kalau menambah fitur: tambahkan test case di `docs/testcases/bugreport.json`, jalankan skrip seed, lalu eksekusi lewat Test run di aplikasi atau agent QA (`docs/revamp/agent/bugboard-qa-runner.md`).
