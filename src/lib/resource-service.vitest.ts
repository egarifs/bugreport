import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./db";
import { executeMcpTool, McpContext } from "./mcp-tools";
import { saveResourceLink, deleteResourceLink } from "./resource-service";

const key = `RSC${Date.now().toString(36).toUpperCase()}`.slice(0, 10);
let projectId: string, owner: { id: string; email: string }, qa: McpContext, vendor: McpContext, viewer: McpContext;
const call = async (name: string, args: object, c: McpContext) => {
  const r = await executeMcpTool(name, args as Record<string, unknown>, c);
  return { ...JSON.parse(r.content[0].text), isError: r.isError ?? false };
};

beforeAll(async () => {
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}_${Date.now()}@example.com`, name: n, status: "ACTIVE" } });
  const [o, q] = await Promise.all([mk("Rina"), mk("Ega")]);
  owner = { id: o.id, email: o.email };
  projectId = (await prisma.project.create({ data: { key, name: "Resource svc", isTest: true } })).id;
  await prisma.projectMember.createMany({ data: [{ projectId, userId: o.id, role: "ADMIN" }, { projectId, userId: q.id, role: "QA" }] });
  const base = { projectId, projectKey: key, actorEmail: q.email, actorId: q.id, apiKeyId: "k" };
  qa = { ...base, role: "QA" }; vendor = { ...base, role: "VENDOR" }; viewer = { ...base, role: "VIEWER" };
});
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
});

describe("AC-AG-03 sumber akun uji hanya link", () => {
  it("validasi URL dan penanggung jawab", async () => {
    expect(await saveResourceLink(owner, projectId, "PRIMARY", { label: "x", url: "javascript:alert(1)" })).toHaveProperty("error");
    expect(await saveResourceLink(owner, projectId, "PRIMARY", { label: "x", url: "https://n.so/a", ownerUserId: "nope" })).toHaveProperty("error");
  });
  it("QA: hanya label, url, owner; tanpa field password", async () => {
    await saveResourceLink(owner, projectId, "PRIMARY", { label: "Akun uji Staging", url: "https://n.so/a", visibility: "INTERNAL", ownerUserId: owner.id });
    const r = await call("list_test_resources", {}, qa);
    expect(r.resources).toEqual([{ label: "Akun uji Staging", url: "https://n.so/a", owner: "Rina" }]);
    expect(JSON.stringify(r)).not.toMatch(/pass|secret|token/i);
    const cols = (await prisma.$queryRaw<{ column_name: string }[]>`select column_name from information_schema.columns where table_name='ProjectResourceLink'`).map((c) => c.column_name);
    expect(cols.some((c) => /pass|secret|token|credential/i.test(c))).toBe(false);
  });
  it("Vendor: kosong bila INTERNAL, link utama bila INTERNAL_AND_VENDOR, link Vendor bila ada; Viewer tidak pernah", async () => {
    expect((await call("list_test_resources", {}, vendor)).resources).toEqual([]);
    await saveResourceLink(owner, projectId, "PRIMARY", { label: "Akun uji Staging", url: "https://n.so/a", visibility: "INTERNAL_AND_VENDOR", ownerUserId: owner.id });
    expect((await call("list_test_resources", {}, vendor)).resources[0].url).toBe("https://n.so/a");
    await saveResourceLink(owner, projectId, "VENDOR", { label: "Akun Vendor", url: "https://n.so/v" });
    expect((await call("list_test_resources", {}, vendor)).resources[0].url).toBe("https://n.so/v");
    expect((await call("list_test_resources", {}, qa)).resources[0].url).toBe("https://n.so/a");
    expect((await call("list_test_resources", {}, viewer)).resources).toEqual([]);
  });
  it("ROLE_MISSING: notifikasi ke penanggung jawab, throttle 1/jam, OK menghapus peringatan", async () => {
    const r1 = await call("report_resource_status", { status: "ROLE_MISSING", role: "Supervisor tim Utara" }, qa);
    expect(r1).toMatchObject({ ok: true, notified: true });
    const n = await prisma.notification.findMany({ where: { projectId, type: "resource_problem" } });
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ userId: owner.id, title: expect.stringContaining("Supervisor tim Utara") });
    expect(await call("report_resource_status", { status: "ROLE_MISSING", role: "Supervisor tim Utara" }, qa)).toMatchObject({ notified: false });
    expect(await prisma.notification.count({ where: { projectId, type: "resource_problem" } })).toBe(1);
    expect((await prisma.projectResourceLink.findFirst({ where: { projectId, audience: "PRIMARY" } }))?.lastProblem).toBe("ROLE_MISSING");
    await call("report_resource_status", { status: "OK" }, qa);
    const row = await prisma.projectResourceLink.findFirst({ where: { projectId, audience: "PRIMARY" } });
    expect(row?.lastProblem).toBeNull();
    expect(row?.lastOkAt).not.toBeNull();
    expect(await call("report_resource_status", { status: "BAD" }, qa)).toHaveProperty("error");
  });
  it("perubahan dan hapus tercatat di audit log", async () => {
    await deleteResourceLink(owner, projectId, "VENDOR");
    const acts = (await prisma.auditLog.findMany({ where: { projectId, entityType: "ProjectResourceLink" } })).map((a) => a.action);
    expect(acts).toEqual(expect.arrayContaining(["resource.create", "resource.update", "resource.delete"]));
  });
});
