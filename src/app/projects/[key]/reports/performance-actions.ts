"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { periodRange } from "@/lib/performance";

/** Catatan konteks: hanya Admin project (project.manage) yang menulis; target harus anggota project. */
export async function savePerformanceNote(projectId: string, projectKey: string, userId: string, periodType: "month" | "quarter", periodKey: string, formData: FormData): Promise<void> {
  const actor = await requireProjectPermission(projectId, "project.manage");
  if (!periodRange(periodType, periodKey)) return;
  if (!(await prisma.projectMember.findFirst({ where: { projectId, userId }, select: { id: true } }))) return;
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  const key = { projectId_userId_periodType_periodKey: { projectId, userId, periodType, periodKey } };
  if (!body) await prisma.performanceNote.deleteMany({ where: { projectId, userId, periodType, periodKey } });
  else await prisma.performanceNote.upsert({ where: key, update: { body, authorId: actor.id }, create: { projectId, userId, periodType, periodKey, body, authorId: actor.id } });
  await prisma.auditLog.create({ data: { projectId, actorId: actor.id, actorEmail: actor.email, action: "performance.note", entityType: "user", entityId: userId, changes: { after: { periodType, periodKey } } } });
  revalidatePath(`/projects/${projectKey}/reports`);
}
