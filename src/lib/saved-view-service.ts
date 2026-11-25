import { prisma } from "./db";
import { hasPermission } from "./permissions";
import { sanitizeViewQuery } from "./bug-list-query";
import type { checkProjectPermission } from "./authz";

type Actor = Awaited<ReturnType<typeof checkProjectPermission>>;

export const SAVED_VIEW_LIMIT = 30;
const NAME_MAX = 60;

export type SavedViewRow = { id: string; name: string; query: string; shared: boolean; mine: boolean };

// Own views plus views shared with the project.
export async function listSavedViews(projectId: string, userId: string): Promise<SavedViewRow[]> {
  const rows = await prisma.savedBugView.findMany({
    where: { projectId, OR: [{ ownerId: userId }, { visibility: "PROJECT" }] },
    orderBy: [{ visibility: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({ id: r.id, name: r.name, query: r.query, shared: r.visibility === "PROJECT", mine: r.ownerId === userId }));
}

// Caller must already be a project member. Sharing with the project needs triage rights (bug.review).
export async function createSavedView(actor: Actor, projectId: string, input: { name: string; query: string; share: boolean }) {
  const name = input.name.trim();
  if (!name) return { error: "Beri nama filter." };
  if (name.length > NAME_MAX) return { error: `Nama maksimal ${NAME_MAX} karakter.` };
  if (input.share && !hasPermission(actor.role, "bug.review", actor.isAdmin)) {
    return { error: "Hanya reviewer yang bisa membagikan filter ke project." };
  }
  if ((await prisma.savedBugView.count({ where: { projectId, ownerId: actor.id } })) >= SAVED_VIEW_LIMIT) {
    return { error: `Maksimal ${SAVED_VIEW_LIMIT} filter tersimpan per project.` };
  }
  try {
    await prisma.savedBugView.create({
      data: { projectId, ownerId: actor.id, name, query: sanitizeViewQuery(input.query), visibility: input.share ? "PROJECT" : "PRIVATE" },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Nama filter sudah dipakai." };
    throw e;
  }
  return { ok: "Filter disimpan." };
}

// Owner or project manager may delete; the lookup is scoped to the project so ids from other projects never match.
export async function deleteSavedView(actor: Actor, projectId: string, id: string) {
  const v = await prisma.savedBugView.findFirst({ where: { id, projectId } });
  if (!v) return { error: "Filter tidak ditemukan." };
  if (v.ownerId !== actor.id && !hasPermission(actor.role, "project.manage", actor.isAdmin)) {
    return { error: "Hanya pembuat filter yang bisa menghapusnya." };
  }
  await prisma.savedBugView.delete({ where: { id } });
  return { ok: "Filter dihapus." };
}
