import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./db";
import { saveTestCaseCore, deleteTestCaseCore } from "./testcase-service";

describe("review: testcase-service edge cases", () => {
  const key = `TCR${Date.now().toString(36).toUpperCase()}`.slice(0, 10);
  let projectId = "", otherProjectId = "", foreignModuleId = "";
  const base = { steps: "1. a", expectedResult: "ok" };
  beforeAll(async () => {
    projectId = (await prisma.project.create({ data: { key, name: "TCR", isTest: true } })).id;
    const o = await prisma.project.create({ data: { key: key + "X", name: "TCR other", isTest: true } });
    otherProjectId = o.id;
    foreignModuleId = (await prisma.module.create({ data: { projectId: o.id, name: "Foreign" } })).id;
  });
  afterAll(async () => {
    for (const id of [projectId, otherProjectId]) {
      await prisma.testCaseVersion.deleteMany({ where: { testCase: { projectId: id } } });
      await prisma.testCase.deleteMany({ where: { projectId: id } });
      await prisma.module.deleteMany({ where: { projectId: id } });
      await prisma.project.delete({ where: { id } });
    }
  });

  it("auto-code tidak menimpa test case lain setelah ada yang dihapus", async () => {
    const a = await saveTestCaseCore(projectId, key, { ...base, title: "A" }); // TC-key-001
    const b = await saveTestCaseCore(projectId, key, { ...base, title: "B" }); // TC-key-002
    await deleteTestCaseCore(projectId, a.id!);
    const c = await saveTestCaseCore(projectId, key, { ...base, title: "C" }); // count=1 -> 002 = milik B
    const rows = await prisma.testCase.findMany({ where: { projectId }, select: { title: true } });
    expect(rows.map((r) => r.title).sort()).toEqual(["B", "C"]);
    expect(c.id).not.toBe(b.id);
  });

  it("moduleId dari project lain ditolak", async () => {
    const r = await saveTestCaseCore(projectId, key, { ...base, title: "X-mod", moduleId: foreignModuleId });
    const tc = r.id ? await prisma.testCase.findUnique({ where: { id: r.id } }) : null;
    expect(tc?.moduleId ?? null).toBeNull();
  });
});
