// Data contoh Project Latihan. Disalin dari docs/revamp/dataset.json (satu-satunya sumber data contoh); perbarui keduanya bersama.
export const SANDBOX_DATASET = {
  "modules": [
    "Kontak",
    "Leads",
    "Laporan",
    "Integrasi WA"
  ],
  "sprints": [
    {
      "name": "Sprint 13",
      "start": "2026-10-06",
      "end": "2026-10-19"
    },
    {
      "name": "Sprint 14",
      "start": "2026-10-20",
      "end": "2026-11-02",
      "current": true
    }
  ],
  "testCases": [
    {
      "code": "TC-018",
      "title": "Supervisor memindahkan pemilik kontak",
      "module": "Kontak",
      "requirement": "§4.2",
      "agentReady": true,
      "role": "Supervisor tim Utara",
      "steps": [
        "Login sebagai Supervisor tim Utara",
        "Buka kontak RS Medika Utama",
        "Klik Pindahkan pemilik → pilih Sales B"
      ],
      "expected": "Pemilik berubah menjadi Sales B dan tercatat di riwayat."
    }
  ],
  "testRuns": [
    {
      "name": "Regresi hak akses",
      "release": "1.8.0",
      "status": "CLOSED",
      "results": {
        "PASS": 5,
        "FAIL": 2,
        "BLOCKED": 1
      },
      "agentSession": {
        "agent": "pi",
        "by": "Ega",
        "newBugs": 1,
        "linkedBugs": 1
      }
    },
    {
      "name": "Smoke 1.8.0",
      "release": "1.8.0",
      "status": "CLOSED"
    },
    {
      "name": "Regresi Leads",
      "release": "1.8.0",
      "status": "IN_PROGRESS"
    }
  ],
  "bugs": [
    {
      "key": "CRM-6",
      "title": "Supervisor tidak bisa memindahkan pemilik kontak",
      "severity": "HIGH",
      "priority": "URGENT",
      "status": "READY_FOR_VERIFICATION",
      "module": "Kontak",
      "environment": "Staging",
      "sprint": "Sprint 14",
      "dueAt": "2026-11-01",
      "foundIn": "1.7.9·b209",
      "fixedIn": "1.8.0·b214",
      "requirement": "§4.2",
      "testCase": "TC-018",
      "testCaseNeedsRerun": true,
      "reporter": "Ega",
      "viaAgent": "pi",
      "reportedAt": "2026-10-30T15:21:00+07:00",
      "assignee": "Dimas",
      "coReporters": [
        "Putri",
        "Sari"
      ],
      "merged": [
        "CRM-21",
        "CRM-23"
      ],
      "mergedBy": "Rina Aulia",
      "actual": "Tombol Simpan tidak merespons; konsol 403.",
      "expected": "Pemilik berubah menjadi Sales B dan tercatat di riwayat.",
      "evidence": [
        "langkah-3.png",
        "trace.zip"
      ]
    },
    {
      "key": "CRM-9",
      "title": "Template WA tidak terkirim ke nomor +62 8xx",
      "severity": "HIGH",
      "priority": "HIGH",
      "status": "READY_FOR_VERIFICATION",
      "module": "Integrasi WA",
      "fixedIn": "1.8.0·b214",
      "assignee": "Sari"
    },
    {
      "key": "CRM-21",
      "title": "Pindah pemilik kontak gagal (Supervisor Utara)",
      "severity": "HIGH",
      "status": "DUPLICATE",
      "duplicateOf": "CRM-6",
      "foundIn": "1.7.9·b209"
    },
    {
      "key": "CRM-23",
      "title": "Tombol Simpan diam saat ganti pemilik",
      "severity": "MEDIUM",
      "status": "DUPLICATE",
      "duplicateOf": "CRM-6",
      "reporter": "Sari",
      "foundIn": "1.7.9·b209"
    },
    {
      "key": "CRM-24",
      "title": "Pemilik kontak tidak bisa diganti",
      "severity": "HIGH",
      "status": "DRAFT",
      "reporter": "Putri",
      "reportedAt": "2026-11-02"
    }
  ]
} as const;
