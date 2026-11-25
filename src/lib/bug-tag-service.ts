import { prisma } from "./db";
import { hasPermission } from "./permissions";
import { recordAuditLog } from "./user-service";
import type { checkProjectPermission } from "./authz";

type Actor = Awaited<ReturnType<typeof checkProjectPermission>>;

export const TAG_NAME_MAX = 30;
export const TAGS_PER_BUG = 10;

// Tags are lowercase words: trims, collapses spaces, strips a leading "#".
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
}

export function listProjectTags(projectId: string) {
  return prisma.bugTag.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// Caller must already be a project member. Tagging is a bug.update action.
export async function addBugTag(actor: Actor, projectId: string, bugId: string, rawName: string) {
  if (!hasPermission(actor.role, "bug.update", actor.isAdmin)) return { error: "Role Anda tidak bisa mengubah tag." };
  const name = normalizeTag(rawName);
  if (!name) return { error: "Isi nama tag." };
  if (name.length > TAG_NAME_MAX) return { error: `Nama tag maksimal ${TAG_NAME_MAX} karakter.` };
  const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId }, select: { id: true, _count: { select: { tags: true } } } });
  if (!bug) return { error: "Bug tidak ditemukan." };
  if (bug._count.tags >= TAGS_PER_BUG) return { error: `Maksimal ${TAGS_PER_BUG} tag per bug.` };

  const tag = await prisma.bugTag.upsert({ where: { projectId_name: { projectId, name } }, create: { projectId, name }, update: {} });
  await prisma.bug.update({ where: { id: bug.id }, data: { tags: { connect: { id: tag.id } } } });
  await recordAuditLog({
    projectId, actorId: actor.id, actorEmail: actor.email, action: "bug.tag_add",
    entityType: "bug", entityId: bug.id, changes: { after: { tag: name } },
  });
  return { ok: `Tag "${name}" ditambahkan.` };
}

export async function removeBugTag(actor: Actor, projectId: string, bugId: string, tagId: string) {
  if (!hasPermission(actor.role, "bug.update", actor.isAdmin)) return { error: "Role Anda tidak bisa mengubah tag." };
  const tag = await prisma.bugTag.findFirst({ where: { id: tagId, projectId, bugs: { some: { id: bugId } } } });
  if (!tag) return { error: "Tag tidak ditemukan di bug ini." };
  await prisma.bug.update({ where: { id: bugId }, data: { tags: { disconnect: { id: tag.id } } } });
  // Drop tags nobody uses any more so the filter list stays short.
  await prisma.bugTag.deleteMany({ where: { id: tag.id, bugs: { none: {} } } });
  await recordAuditLog({
    projectId, actorId: actor.id, actorEmail: actor.email, action: "bug.tag_remove",
    entityType: "bug", entityId: bugId, changes: { before: { tag: tag.name } },
  });
  return { ok: `Tag "${tag.name}" dihapus.` };
}
