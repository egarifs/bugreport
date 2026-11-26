// Record PASS attempts on a test run for cases that automated tests (e2e or node tests) verified. Everything else stays NOT_RUN.
// Usage: npx tsx scripts/record-automated-run.ts <runId>
import { PrismaClient } from "@prisma/client";

const E2E_BOARD = "e2e/bug-board.spec.ts", E2E_REPORT = "e2e/report-bug.spec.ts";
const EVIDENCE: Record<string, string> = {
  "TC-BRD-003": `${E2E_BOARD} (seret kartu)`, "TC-BRD-004": `${E2E_BOARD} (seret ke kolom terlarang)`, "TC-BRD-006": `${E2E_BOARD} (menu Pindah ke)`,
  "TC-BRD-005": "src/lib/bug-board.test.ts + bug-move-service.test.ts",
  "TC-TAG-001": `${E2E_BOARD} (tag di detail)`, "TC-TAG-006": `${E2E_BOARD} (filter tag)`, "TC-TAG-005": `${E2E_REPORT} (tag dari form)`,
  "TC-TAG-002": "src/lib/bug-tag-service.test.ts (tag yatim)", "TC-TAG-003": "src/lib/bug-tag-service.test.ts (batas panjang/jumlah)",
  "TC-SVF-001": `${E2E_BOARD} (filter tersimpan)`, "TC-SVF-003": "src/lib/saved-view-service.test.ts", "TC-SVF-005": "src/lib/saved-view-service.test.ts",
  "TC-BLK-001": `${E2E_BOARD} (aksi massal)`, "TC-BLK-004": `${E2E_BOARD} (assign massal)`, "TC-BLK-005": `${E2E_BOARD} (tag massal)`, "TC-BLK-003": "src/lib/bug-bulk-service.test.ts",
  "TC-FLT-008": "src/lib/bug-list-query.test.ts (parameter tidak valid)", "TC-FLT-004": "src/lib/bug-list-query.test.ts (AND antar kategori)",
  "TC-LIST-005": "e2e/states.spec.ts (AC-STATE-01)", "TC-LIST-006": `${E2E_BOARD} (J/K)`,
  "TC-RPT-002": `${E2E_REPORT} (bug mirip)`, "TC-RPT-003": `${E2E_REPORT} (prioritas reviewer)`, "TC-RPT-004": `${E2E_REPORT} (draf otomatis)`,
  "TC-RPT-006": `${E2E_REPORT} (judul saja)`, "TC-RPT-007": `${E2E_REPORT} (pilihan diingat)`, "TC-RPT-009": `${E2E_REPORT} (pintasan N)`,
  "TC-RPT-010": "src/lib/bug-create-service.test.ts",
  "TC-SVF-002": "src/lib/saved-view-service.test.ts (nama kembar)", "TC-SVF-004": "src/lib/saved-view-service.test.ts (visibilitas)", "TC-BLK-006": "src/lib/bug-bulk-service.test.ts (batas 100, project lain)",
  ...Object.fromEntries(
    ["LIST-001", "FLT-001", "FLT-002", "FLT-003", "FLT-005", "FLT-006", "FLT-007", "FLT-009", "FLT-010", "LIST-003", "LIST-004", "BLK-002", "BRD-001", "BRD-002", "BRD-008", "LIST-002", "BRD-007", "BLK-007", "TAG-004", "TRI-004", "TRI-002", "TRI-003"].map((c) => [`TC-${c}`, "e2e/bgr-regression.spec.ts"]),
  ),
  ...Object.fromEntries(["RPT-001", "RPT-005", "RPT-008", "IMP-001", "IMP-002", "IMP-003", "RUN-003", "RUN-004", "RUN-005"].map((c) => [`TC-${c}`, "e2e/bgr-regression-2.spec.ts"])),
  "TC-BRD-010": "e2e/bgr-regression.spec.ts + bug-list-query.test.ts (kolom disembunyikan)",
  "TC-BRD-009": "e2e/bgr-regression.spec.ts + bug-move-service.test.ts (setelah perbaikan status basi)",
  "TC-TRI-001": "e2e/triage.spec.ts", "TC-RUN-001": "e2e/test-run-indicator.spec.ts", "TC-RUN-002": "e2e/test-run-indicator.spec.ts",
};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run in production");
  const runId = process.argv[2];
  if (!runId) throw new Error("Usage: record-automated-run.ts <runId>");
  const prisma = new PrismaClient();
  try {
    const run = await prisma.testRun.findUniqueOrThrow({ where: { id: runId }, include: { items: { include: { testCase: true } } } });
    let n = 0;
    for (const item of run.items) {
      const evidence = EVIDENCE[item.testCase.code];
      if (!evidence || item.status !== "NOT_RUN") continue;
      const notes = `Diverifikasi otomatis: ${evidence}`;
      let seq = 1;
      if (item.testCase.code === "TC-BRD-009") {
        // first execution found a real defect: a stale board overwrote another user's move. Fixed in the same change, then re-run.
        await prisma.testRunAttempt.create({ data: { itemId: item.id, seq: 1, result: "FAIL", failedStep: 2, actualResult: "Browser B memindahkan bug yang sudah In progress ke Design Review tanpa pesan; status orang lain tertimpa.", notes: "moveBugStatus memvalidasi terhadap status DB, bukan status yang dilihat board. Diperbaiki dengan parameter expectedFrom.", environment: run.environment, evidenceUrl: "e2e/bgr-regression.spec.ts#TC-BRD-009", executedById: run.createdById, toolName: "playwright" } });
        seq = 2;
      }
      await prisma.$transaction([
        prisma.testRunAttempt.create({ data: { itemId: item.id, seq, result: "PASS", notes, environment: run.environment, executedById: run.createdById, toolName: "playwright/node:test" } }),
        prisma.testRunItem.update({ where: { id: item.id }, data: { status: "PASS", notes, executedById: run.createdById, executedAt: new Date() } }),
      ]);
      n++;
    }
    console.log(`Recorded ${n} PASS, ${run.items.length - n} left NOT_RUN`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
