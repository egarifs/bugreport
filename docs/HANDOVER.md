# BugReport by egarifs — Engineering Handover Documentation

Dokumentasi teknis menyeluruh sistem BugReport untuk tim internal QA, Developer, dan Integrasi AI.

---

## 1. Arsitektur & Spesifikasi Stack

| Layer | Teknologi | Catatan Implementasi |
|---|---|---|
| **Framework** | Next.js 15 (App Router, React 19, TS) | Server Actions, Server Components, Streaming |
| **Styling** | Tailwind CSS v3 (PostCSS pipeline) | Menghindari build worker bus error di kernel Linux |
| **Database** | PostgreSQL 16 + `pg_trgm` | Port container: `5434` (Docker Compose) |
| **ORM** | Prisma 6.6.0 | Atomic transactions, foreign keys, cascade deletes |
| **Autentikasi** | Auth.js (NextAuth v5 beta) | JWT session parsing langsung via `getToken` di middleware |
| **AI Protocol** | Model Context Protocol (MCP) Streamable HTTP | JSON-RPC 2.0 endpoint di `/api/mcp` |
| **Dokumentasi API** | OpenAPI 3.0 + Swagger UI | `/api-docs` & `/api/docs/openapi.json` |

---

## 2. Port & Lingkungan Server

- **Web Application**: `http://localhost:3001` (Port dialihkan dari 3000 karena digunakan `testflow-api`).
- **PostgreSQL**: `localhost:5434` (`postgres:postgres@localhost:5434/bugreport`).
- **Super Admin Accounts**:
  - `admin@local.test` (Local admin)
  - `egarifs@gmail.com`
  - `ega@sismedika.com`

---

## 3. Fitur Utama & Modul Selesai (Phase 1 s/d Phase 3)

### A. Phase 1 — Foundation & Super Admin
- **Pending Approval Workflow**: User baru mendaftar default berstatus `PENDING` dan diarahkan ke `/pending`.
- **Admin Approval Queue**: Super Admin menyetujui, menolak, atau menangguhkan akun di `/admin/users`.
- **Project & Bug CRUD**: Pembuatan bug lengkap dengan auto-increment key per project (`CRM-1`, `CRM-2`).
- **Bugasura-Style Metric Cards**: Ringkasan status Total Bugs, Draft/AI, Open, In Progress, Ready for Verification, Closed.

### B. Phase 2 — Vendor Workflow & Quality Gates
- **Isolasi Catatan Internal**: Catatan berjenis `INTERNAL` otomatis difilter dan disembunyikan dari role Vendor & Client.
- **Guard Transisi Status**:
  - Vendor tidak bisa mempromosikan status `Draft` → `Open`.
  - Vendor tidak bisa melakukan `Close` atau `Reopen` bug langsung.
  - QA/Admin mewajibkan input `buildNumber` atau `appVersion` sebelum bug dibuka (`Draft` → `Open`).
  - Reopen bug tertutup wajib mencantumkan alasan (`reopenReason`) dan otomatis menginkremen counter `reopenCount`.
- **Real-time Duplicate Search**: Endpoint `/api/projects/[key]/duplicates` menggunakan native PostgreSQL trigram `similarity(title, q) > 0.35`.

### C. Phase 2B — Business Documents & Test Cases Management
- **Versi Dokumen PRD/BRD**: Upload PDF/MD (maks 20 MB) di `/projects/[key]/docs`. Nama dokumen yang sama otomatis menaikkan versi (`v1`, `v2`, ...) tanpa menghapus arsip lama.
- **Import Test Case Spreadsheet**: Mendukung import file `.xlsx` dan `.csv` sesuai template spreadsheet CRM (`TC_*`, Area, Judul, Prioritas, Role, Prasyarat, Langkah, Ekspektasi).
- **Test Run Execution**: Membuat sesi uji rilis per environment (Staging/Production/UAT) di `/projects/[key]/test-runs/[runId]` dengan status `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`.
- **Idempotent "Create Bug Draft"**: Tombol sekali klik pada test case `FAIL` yang langsung mengisi metadata form bug dan menghubungkan relasi referensi tanpa membuat bug duplikat jika ditekan berulang.

### D. Phase 3 — AI Agent & MCP Server (Model Context Protocol)
- **Streamable HTTP MCP Endpoint**: `POST /api/mcp` berbasis JSON-RPC 2.0.
- **MCP Tools**:
  1. `search_bugs`: Pencarian bug berbasis query judul/deskripsi, status, dan severity.
  2. `get_bug`: Mengambil detail lengkap bug dan riwayat komentar publik.
  3. `create_bug_draft`: Membuat bug otomatis dari agen testing CI/CD.
     - **Enforce DRAFT**: Status selalu `DRAFT` (tidak bisa dipaksa `OPEN` oleh agent).
     - **Trigram Similarity Guard**: Menolak pelaporan jika ada bug aktif serupa dengan kemiripan `≥ 0.60` (dapat di-override via `force: true`).
     - **Secret Redaction**: Otomatis menyamarkan Bearer token, Claude token, dan password sebelum disimpan.
  4. `add_bug_comment`: Menambahkan log atau catatan hasil eksekusi agent.
  5. `attach_bug_screenshot`: Mengunggah screenshot bukti error via Base64 ke disk volume.
- **API Key & Rate Limiting**:
  - Key di-generate di `/projects/[key]/settings` dengan format `br_live_<hex>`.
  - Key disimpan dalam bentuk hash SHA-256 dan hanya ditampilkan sekali saat dibuat.
  - Rate limit database: 30 request per menit per key.
  - Dukungan pencabutan akses (*Revoke API key*).

---

## 4. Panduan Swagger UI & API Collection

Untuk tim QA Automation, Frontend, atau integrasi pihak ketiga:
- **Swagger Web UI**: Buka browser di [http://localhost:3001/api-docs](http://localhost:3001/api-docs) untuk mencoba endpoint secara interaktif.
- **OpenAPI 3.0 Spec**: Download atau import link [http://localhost:3001/api/docs/openapi.json](http://localhost:3001/api/docs/openapi.json) langsung ke aplikasi **Postman**, **Insomnia**, atau **Bruno**.

### Contoh Payload Autentikasi MCP (JSON-RPC):
```bash
curl -X POST http://localhost:3001/api/mcp \
  -H "Authorization: Bearer br_live_YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_bug_draft",
      "arguments": {
        "title": "Gagal klik tombol submit pada form pendaftaran",
        "stepsToReproduce": "1. Buka formulir\n2. Klik submit",
        "expectedResult": "Muncul modal sukses",
        "actualResult": "Muncul toast error 500",
        "environment": "Staging",
        "severity": "HIGH",
        "priority": "HIGH"
      }
    }
  }'
```

---

## 5. Menjalankan Server & Testing Lokal

### Memulai Database & Aplikasi:
```bash
cd ~/lab/bugreport

# 1. Jalankan PostgreSQL Docker
docker compose up -d

# 2. Sinkronisasi Skema Prisma (jika ada migrasi baru)
npx prisma db push

# 3. Jalankan automated test suite (34 tests)
npm test

# 4. Build & Jalankan Production Server di Port 3001
npm run build
PORT=3001 npx next start -p 3001
```

### Log & Troubleshooting:
- Log background server Next.js tersimpan di: `/tmp/bugreport-server.log`.
- Periksa port aktif: `ss -ltn | grep ':3001\b'`.
- Matikan proses gantung: `fuser -k 3001/tcp`.
