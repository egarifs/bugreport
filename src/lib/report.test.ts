import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { getProjectReport, exportBugsCsv, csvCell } from "./report";

test("PRD-05 Reporting & Release Readiness", async (t) => {
  const stamp = Date.now().toString().slice(-5);
  const project = await prisma.project.create({ data: { key: `R5${stamp}`, name: "Report fixture" } });
  const qa = await prisma.user.create({ data: { email: `qa_rep_${stamp}@example.com`, status: "ACTIVE" } });
  const dev = await prisma.user.create({ data: { email: `dev_rep_${stamp}@example.com`, name: "Dev", status: "ACTIVE" } });

  const base = {
    projectId: project.id, reporterId: qa.id, description: "d", stepsToReproduce: "s",
    expectedResult: "e", actualResult: "a", environment: "Staging",
  };
  const fixtures = [
    { severity: "BLOCKER", status: "OPEN", assigneeId: dev.id, appVersion: "1.2" },
    { severity: "HIGH", status: "CLOSED", appVersion: "1.2" },
    { severity: "MEDIUM", status: "IN_PROGRESS", assigneeId: dev.id, reopenCount: 1 },
    { severity: "LOW", status: "DRAFT", createdAt: new Date(Date.now() - 5 * 86_400_000) },
    { severity: "HIGH", status: "OPEN", appVersion: "1.3", title: "=HYPERLINK(\"x\")" },
  ] as const;
  for (const [i, f] of fixtures.entries()) {
    await prisma.bug.create({
      data: { ...base, title: `Bug ${i + 1}`, ...f, number: i + 1, key: `${project.key}-${i + 1}` },
    });
  }
  await prisma.bugComment.create({
    data: { bugId: (await prisma.bug.findFirstOrThrow({ where: { projectId: project.id } })).id, authorId: qa.id, body: "SECRET_INTERNAL", type: "INTERNAL" },
  });

  await t.test("metrics match fixture", async () => {
    const r = await getProjectReport(project.id);
    assert.equal(r.byStatus.OPEN, 2);
    assert.equal(r.byStatus.CLOSED, 1);
    assert.deepEqual(r.openBySeverity, { BLOCKER: 1, MEDIUM: 1, LOW: 1, HIGH: 1 });
    assert.equal(r.reopened, 1);
    assert.deepEqual(r.staleDrafts.map((d) => d.key), [`${project.key}-4`]);
    assert.equal(r.workload.find((w) => w.assignee === "Dev")?.count, 2);
    assert.equal(r.workload.find((w) => w.assignee === "Unassigned")?.count, 2);
    assert.equal(r.releaseReady, false);
    assert.equal(r.releaseBlockers.length, 2);
  });

  await t.test("release readiness scoped by target version", async () => {
    assert.equal((await getProjectReport(project.id, "1.2")).releaseBlockers.length, 1);
    assert.equal((await getProjectReport(project.id, "9.9")).releaseReady, true);
  });

  await t.test("CSV excludes internal notes and neutralizes formulas", async () => {
    const csv = await exportBugsCsv(project.id);
    assert.equal(csv.split("\r\n").length, 6);
    assert.ok(!csv.includes("SECRET_INTERNAL"));
    assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
    assert.equal(csvCell("-1"), `"'-1"`);
  });
});
