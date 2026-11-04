# Plan: Jam.dev Webhook Pipeline (CRM Bug Automation)

## 1. Goal
Setiap kali ada rekaman bug baru (**Create Jam**) di folder **CRM** pada Jam.dev:
1. **Discord Alert**: Kirim notifikasi instan ke channel Discord.
2. **Local Bug App Ticket**: Auto-create tiket pada aplikasi bug report di `/home/ea/lab/bugreport`.
3. **Automated Test Trigger**: Auto-trigger Playwright test / validation script untuk mereproduksi atau memverifikasi area terkait.

---

## 2. Architecture & Flow

```text
[ Tester record bug via Jam Extension ]
                 │
                 ▼
          [ Jam.dev Cloud ]
                 │
                 ▼ (HTTP POST Webhook)
       [ Webhook Receiver Engine ]
       (FastAPI / Node.js di /home/ea/lab/bugreport)
                 │
                 ├─► 1. Filter: cek folder == "CRM" (skip jika folder lain)
                 │
                 ├─► 2. Kirim Rich Embed ke Discord Webhook
                 │      (Judul, link Jam, browser/OS, reporter, preview image)
                 │
                 ├─► 3. Insert Tiket ke Database Aplikasi Bug Report
                 │      (SQLite / Postgres lokal di /home/ea/lab/bugreport)
                 │
                 └─► 4. Trigger Playwright Spec
                        (Ad-hoc test runner via Playwright CLI sesuai tag modul)
```

---

## 3. Detailed Component Plan

### A. Webhook Receiver Service
- **Lokasi**: `/home/ea/lab/bugreport/webhook/`
- **Stack Rekomendasi**: FastAPI (Python) atau Express / Fastify (Node.js).
- **Endpoint**: `POST /api/webhooks/jam`
- **Security**: Validasi `Jam-Signature` header (HMAC SHA-256) menggunakan secret webhook dari Jam dashboard.
- **Logika Filter Folder**:
  - Ambil `folder_id` atau `folder_name` dari payload Jam.
  - Hanya proses jika target = `CRM`.

### B. Discord Notification
- Menggunakan Discord Incoming Webhook (tidak perlu bot token rumit).
- Format Rich Embed:
  - **Title**: `[NEW BUG] {jam.title}`
  - **Fields**:
    - **Reporter**: `{jam.author.name} ({jam.author.email})`
    - **URL / Environment**: `{jam.origin_url}`
    - **Device**: `{jam.browser} on {jam.os}`
    - **Console / Network**: Jumlah error / status API gagal
  - **Link**: Tombol langsung ke link `https://jam.dev/c/{jam.id}`

### C. Tiket Aplikasi Bug Report
- Menyimpan record bug ke database lokal aplikasi bug report:
  - ID Tiket (auto-increment / UUID)
  - Jam ID & URL
  - Modul / Area (diekstrak dari URL `crm.sismedika.biz.id/dashboard/{modul}`)
  - Status: `Draft` (default)
  - Raw payload / Network errors / Console errors
  - Created timestamp

### D. Automated Test Trigger
- **Kondisi**: Jika URL target mengarah ke area yang sudah memiliki spec Playwright (misal `/dashboard/access-control`).
- **Eksekusi**:
  - Background process worker (Celery, BullMQ, atau background task asynchronous).
  - Menjalankan `npx playwright test tests/specs/{modul}/... --reporter=line`.
  - Mengembalikan output test ke tiket aplikasi bug report dan comment update ke Discord.

---

## 4. Setup Steps (Checklist Implementasi)

1. [ ] Buat folder `/home/ea/lab/bugreport/webhook`.
2. [ ] Siapkan webhook server (`server.js` atau `main.py`).
3. [ ] Konfigurasi tunnel publik (Cloudflare Tunnel / ngrok) atau port domain jika server punya IP publik.
4. [ ] Buka Jam.dev Dashboard > Settings > Webhooks > **Add Webhook Endpoint**:
   - URL: `https://<domain-kamu>/api/webhooks/jam`
   - Events: `jam.created`
5. [ ] Set environment variables di `/home/ea/lab/bugreport/.env`:
   - `JAM_WEBHOOK_SECRET`
   - `JAM_TARGET_FOLDER=CRM`
   - `DISCORD_WEBHOOK_URL`
   - `DATABASE_URL`
   - `PLAYWRIGHT_DIR=/home/ea/Automation/CRM`
6. [ ] Uji coba: Buat 1 rekaman Jam di folder CRM, verifikasi:
   - Discord menerima embed.
   - Database lokal bertambah 1 row tiket.
   - Runner Playwright terpanggil.
