import type { ProjectRole, ResourceAudience, ResourceProblem } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseUrl } from "@/lib/bug-input";
import { recordAuditLog } from "@/lib/user-service";
import { notifyResourceProblem } from "@/lib/notify";

// F9 / AC-AG-03: only a link to the test-accounts document is stored. No credential fields exist in schema or responses.
export const PROBLEM_COOLDOWN_MS = 60 * 60_000; // max 1 notification per hour per problem

type Ctx = { projectId: string; projectKey: string; actorId: string; actorEmail: string; role: ProjectRole };
const err = (error: string) => ({ error });

// Admin/QA/Developer: PRIMARY. Vendor: VENDOR link if set, else PRIMARY only when visibility allows. Client/Viewer: never.
export async function resourceForRole(projectId: string, role: ProjectRole) {
  if (role === "CLIENT" || role === "VIEWER") return null;
  const rows = await prisma.projectResourceLink.findMany({ where: { projectId, kind: "TEST_ACCOUNTS" }, include: { owner: { select: { name: true, email: true } } } });
  const primary = rows.find((r) => r.audience === "PRIMARY");
  if (role !== "VENDOR") return primary ?? null;
  return rows.find((r) => r.audience === "VENDOR") ?? (primary?.visibility === "INTERNAL_AND_VENDOR" ? primary : null);
}

export async function listTestResources(ctx: Ctx) {
  const r = await resourceForRole(ctx.projectId, ctx.role);
  return { ok: true as const, resources: r ? [{ label: r.label, url: r.url, owner: r.owner?.name || r.owner?.email || null }] : [] };
}

export async function reportResourceStatus(ctx: Ctx, a: { status?: string; role?: string }) {
  if (!["OK", "UNREACHABLE", "ROLE_MISSING"].includes(String(a.status))) return err("status harus OK, UNREACHABLE, atau ROLE_MISSING.");
  const r = await resourceForRole(ctx.projectId, ctx.role);
  if (!r) return err("Tidak ada sumber akun uji untuk peran ini.");
  const now = new Date();
  if (a.status === "OK") {
    await prisma.projectResourceLink.update({ where: { id: r.id }, data: { lastOkAt: now, lastOkByUserId: ctx.actorId, lastProblem: null, lastProblemRole: null } });
    return { ok: true as const, notified: false };
  }
  const problem = a.status as ResourceProblem;
  const role = a.role?.trim().slice(0, 80) || null;
  const repeat = r.lastProblem === problem && r.lastProblemRole === role && r.lastProblemAt && now.getTime() - r.lastProblemAt.getTime() < PROBLEM_COOLDOWN_MS;
  if (repeat) return { ok: true as const, notified: false };
  await prisma.projectResourceLink.update({ where: { id: r.id }, data: { lastProblem: problem, lastProblemRole: role, lastProblemAt: now } });
  const sent = await notifyResourceProblem({ projectId: ctx.projectId, projectKey: ctx.projectKey, ownerId: r.ownerUserId, label: r.label, problem, role, actor: { id: ctx.actorId, email: ctx.actorEmail } });
  return { ok: true as const, notified: sent > 0 };
}

// Admin (project.manage) only; caller enforces permission.
export async function saveResourceLink(
  actor: { id: string; email: string },
  projectId: string,
  audience: ResourceAudience,
  input: { label: string; url: string; visibility?: string; ownerUserId?: string | null }
) {
  const label = input.label.trim();
  if (!label || label.length > 80) return err("Label wajib diisi, maksimal 80 karakter.");
  let url: string | null;
  try { url = parseUrl(input.url, "URL"); } catch (e) { return err((e as Error).message); }
  if (!url) return err("Isi URL dokumen akun uji.");
  if (input.ownerUserId && !(await prisma.projectMember.findFirst({ where: { projectId, userId: input.ownerUserId } }))) return err("Penanggung jawab harus anggota project.");
  const data = {
    label, url,
    visibility: audience === "PRIMARY" && input.visibility === "INTERNAL_AND_VENDOR" ? ("INTERNAL_AND_VENDOR" as const) : ("INTERNAL" as const),
    ownerUserId: input.ownerUserId || null,
  };
  const where = { projectId_kind_audience: { projectId, kind: "TEST_ACCOUNTS" as const, audience } };
  const before = await prisma.projectResourceLink.findUnique({ where });
  // url changed = old problem no longer relevant
  const row = await prisma.projectResourceLink.upsert({
    where,
    create: { projectId, audience, ...data },
    update: { ...data, ...(before && before.url !== url ? { lastProblem: null, lastProblemRole: null, lastProblemAt: null, lastOkAt: null } : {}) },
  });
  await recordAuditLog({ projectId, actorId: actor.id, actorEmail: actor.email, action: before ? "resource.update" : "resource.create", entityType: "ProjectResourceLink", entityId: row.id, changes: { before: before ? { label: before.label, url: before.url, visibility: before.visibility } : null, after: { label, url, visibility: data.visibility } } });
  return { ok: true as const };
}

export async function deleteResourceLink(actor: { id: string; email: string }, projectId: string, audience: ResourceAudience) {
  const row = await prisma.projectResourceLink.findUnique({ where: { projectId_kind_audience: { projectId, kind: "TEST_ACCOUNTS", audience } } });
  if (!row) return err("Link tidak ditemukan.");
  await prisma.projectResourceLink.delete({ where: { id: row.id } });
  await recordAuditLog({ projectId, actorId: actor.id, actorEmail: actor.email, action: "resource.delete", entityType: "ProjectResourceLink", entityId: row.id, changes: { before: { label: row.label, url: row.url }, after: null } });
  return { ok: true as const };
}
