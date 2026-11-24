import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { SANDBOX_DATASET as D } from "@/lib/sandbox-dataset";
import { sandboxKeyFor } from "@/lib/sandbox-key";
import type { BugSeverity, BugStatus, BugPriority } from "@prisma/client";

const PRD = `# PRD Latihan

## 4.2 Hak akses

Supervisor dapat memindahkan pemilik kontak ke Sales lain dalam timnya.

**Kriteria penerimaan**
- Pemilik berubah dan tercatat di riwayat aktivitas.
- Hanya Supervisor dan Admin yang melihat tombol Pindahkan pemilik.

## 5.1 Integrasi WhatsApp

Template pesan dikirim ke nomor kontak yang valid.
`;

/** Hapus isi sandbox pengguna lalu isi ulang dari data contoh. Hanya menyentuh project Latihan miliknya (isSandbox + sandboxOwnerId). */
export async function seedSandbox(userId: string) {
  const key = sandboxKeyFor(userId);
  const project = await prisma.project.upsert({
    where: { sandboxOwnerId: userId },
    update: {},
    create: { key, name: "Project Latihan", description: "Data contoh untuk berlatih. Aman dicoba dan bisa direset.", isSandbox: true, sandboxOwnerId: userId },
  });
  if (!project.isSandbox || project.sandboxOwnerId !== userId) throw new Error("Bukan project Latihan milik pengguna ini");
  const pid = project.id;

  await prisma.$transaction(async (tx) => {
    // Urutan hapus mengikuti relasi: run/bug/test case/dokumen/modul/sprint. Anggota dan project dipertahankan.
    await tx.stlcDoc.deleteMany({ where: { projectId: pid } });
    await tx.testRun.deleteMany({ where: { projectId: pid } });
    await tx.bug.deleteMany({ where: { projectId: pid } });
    await tx.testCase.deleteMany({ where: { projectId: pid } });
    await tx.businessDoc.deleteMany({ where: { projectId: pid } });
    await tx.sprint.deleteMany({ where: { projectId: pid } });
    await tx.module.deleteMany({ where: { projectId: pid } });
    await tx.notification.deleteMany({ where: { projectId: pid } });
    await tx.projectMember.upsert({ where: { projectId_userId: { projectId: pid, userId } }, create: { projectId: pid, userId, role: "ADMIN" }, update: { role: "ADMIN" } });

    const modules = new Map<string, string>();
    for (const [i, name] of D.modules.entries()) modules.set(name, (await tx.module.create({ data: { projectId: pid, name, sortOrder: i } })).id);
    const sprints = new Map<string, string>();
    for (const s of D.sprints) {
      const cur = "current" in s && s.current;
      sprints.set(s.name, (await tx.sprint.create({ data: { projectId: pid, name: s.name, startsAt: new Date(s.start), endsAt: new Date(s.end), status: cur ? "ACTIVE" : "COMPLETED", closedAt: cur ? null : new Date(s.end) } })).id);
    }
    const cases = new Map<string, string>();
    for (const t of D.testCases) {
      cases.set(t.code, (await tx.testCase.create({ data: { projectId: pid, code: t.code, title: t.title, moduleArea: t.module, moduleId: modules.get(t.module), targetRole: t.role, steps: t.steps.map((s, i) => `${i + 1}) ${s}`).join("\n"), expectedResult: t.expected, priority: "HIGH", testType: "Functional", agentReady: t.agentReady } })).id);
    }
    for (const r of D.testRuns) {
      const run = await tx.testRun.create({ data: { projectId: pid, name: r.name, environment: "Staging", buildVersion: r.release, status: r.status === "CLOSED" ? "COMPLETED" : "IN_PROGRESS", createdById: userId } });
      const first = [...cases.values()][0];
      if (first) await tx.testRunItem.create({ data: { testRunId: run.id, testCaseId: first, status: "results" in r && r.results.FAIL ? "FAIL" : "results" in r && r.results.PASS ? "PASS" : "NOT_RUN" } });
    }
    const bugIds = new Map<string, string>();
    let seq = 0;
    for (const b of D.bugs) {
      const number = Number(b.key.slice(b.key.lastIndexOf("-") + 1));
      seq = Math.max(seq, number);
      const dupOf = "duplicateOf" in b ? bugIds.get(b.duplicateOf) : undefined;
      const row = await tx.bug.create({
        data: {
          key: `${key}-${number}`, number, projectId: pid, title: b.title,
          severity: b.severity as BugSeverity, priority: ("priority" in b ? b.priority : "NORMAL") as BugPriority, status: b.status as BugStatus,
          moduleId: "module" in b ? modules.get(b.module) : undefined, reporterId: userId,
          actualResult: "actual" in b ? b.actual : "", expectedResult: "expected" in b ? b.expected : "",
          environment: "environment" in b ? b.environment : "",
          appVersion: "foundIn" in b ? b.foundIn.split("·")[0] : null,
          fixedInVersion: "fixedIn" in b ? b.fixedIn.split("·")[0] : null, fixedInBuild: "fixedIn" in b ? b.fixedIn.split("·")[1] : null,
          dueAt: "dueAt" in b ? new Date(b.dueAt) : null,
          sprintId: "sprint" in b ? sprints.get(b.sprint) : undefined,
          duplicateOfId: dupOf,
        },
      });
      bugIds.set(b.key, row.id);
    }
    await tx.project.update({ where: { id: pid }, data: { bugSeq: seq } });

    const slug = "prd-latihan";
    const fileName = "PRD-Latihan.md", stored = `sandbox-${userId.slice(0, 8)}-prd.md`;
    const dir = path.resolve(process.cwd(), "uploads", key, "docs");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, stored), PRD, "utf8");
    await tx.businessDoc.create({ data: { projectId: pid, title: "PRD Latihan", slug, versions: { create: { versionNum: 1, fileName, storedPath: stored, fileSize: Buffer.byteLength(PRD), mimeType: "text/markdown", isCurrent: true, status: "APPROVED", uploadedById: userId } } } });
  });
  return project;
}

/** Reset = seed ulang. Bersihkan juga berkas unggahan sandbox. */
export async function resetSandbox(userId: string) {
  const key = sandboxKeyFor(userId);
  await fs.rm(path.resolve(process.cwd(), "uploads", key), { recursive: true, force: true });
  return seedSandbox(userId);
}

/** Hapus total project Latihan pengguna beserta berkasnya (mis. pengguna ditolak). Project harus dihapus sebelum pengguna karena Bug.reporter membatasi penghapusan. */
export async function deleteSandbox(userId: string) {
  const p = await prisma.project.findUnique({ where: { sandboxOwnerId: userId }, select: { id: true, key: true, isSandbox: true } });
  if (!p || !p.isSandbox) return false;
  await prisma.project.delete({ where: { id: p.id } });
  await fs.rm(path.resolve(process.cwd(), "uploads", p.key), { recursive: true, force: true });
  return true;
}

/** Hapus Latihan milik pengguna ditolak/ditangguhkan, atau yang tidak disentuh `days` hari (tanpa aksi di audit log). */
export async function pruneStaleSandboxes(days = 90, now = new Date()) {
  const cutoff = new Date(+now - days * 86_400_000);
  const boxes = await prisma.project.findMany({
    where: { isSandbox: true, sandboxOwnerId: { not: null } },
    select: { sandboxOwnerId: true, createdAt: true, id: true, sandboxOwner: { select: { status: true } } },
  });
  let removed = 0;
  for (const b of boxes) {
    const dead = b.sandboxOwner?.status === "REJECTED" || b.sandboxOwner?.status === "SUSPENDED";
    const idle = b.createdAt < cutoff && (await prisma.auditLog.count({ where: { projectId: b.id, createdAt: { gte: cutoff } } })) === 0;
    if ((dead || idle) && b.sandboxOwnerId && (await deleteSandbox(b.sandboxOwnerId))) removed++;
  }
  return removed;
}
