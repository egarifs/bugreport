"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { sectionDor } from "@/lib/requirement-service";

type Op = "ready" | "devdone" | "criterion" | "module" | "link" | "unlink" | "sprint";

/** Satu pintu untuk semua perubahan bagian requirement. Otorisasi + kepemilikan project diperiksa di server. */
export async function updateSection(sectionId: string, op: Op, formData: FormData): Promise<void> {
  const found = await sectionDor(sectionId);
  if (!found) return;
  const { section, dor } = found;
  const project = await prisma.businessDoc.findUnique({ where: { id: section.docId }, select: { projectId: true, project: { select: { key: true } } } });
  if (!project) return;
  const actor = await requireProjectPermission(project.projectId, "doc.manage");
  const val = String(formData.get("value") ?? "").trim();
  const owned = <T extends { projectId: string } | null>(r: T) => (r && r.projectId === project.projectId ? r : null);

  if (op === "ready") {
    if (!dor.ready || section.status !== "APPROVED") return;
    await prisma.requirementSection.update({ where: { id: sectionId }, data: { status: "READY", readyAt: new Date() } });
  } else if (op === "devdone") {
    if (section.status !== "IN_SPRINT" && section.status !== "READY") return;
    await prisma.requirementSection.update({ where: { id: sectionId }, data: { status: "DEV_DONE", devDoneAt: new Date(), devDoneById: actor.id } });
  } else if (op === "criterion") {
    if (!val || val.length > 500) return;
    await prisma.requirementSection.update({ where: { id: sectionId }, data: { acceptanceCriteria: { push: val } } });
  } else if (op === "module") {
    const m = val ? owned(await prisma.module.findUnique({ where: { id: val }, select: { projectId: true } })) : null;
    await prisma.requirementSection.update({ where: { id: sectionId }, data: { moduleId: m ? val : null } });
  } else if (op === "link") {
    const tc = owned(await prisma.testCase.findUnique({ where: { id: val }, select: { projectId: true } }));
    if (tc) await prisma.testCase.update({ where: { id: val }, data: { sectionId } });
  } else if (op === "unlink") {
    await prisma.testCase.updateMany({ where: { id: val, projectId: project.projectId, sectionId }, data: { sectionId: null } });
  } else if (op === "sprint") {
    const sp = val ? owned(await prisma.sprint.findUnique({ where: { id: val }, select: { projectId: true } })) : null;
    await prisma.requirementSection.update({ where: { id: sectionId }, data: { sprintId: sp ? val : null, ...(sp && section.status === "READY" ? { status: "IN_SPRINT" } : {}) } });
  }
  await prisma.auditLog.create({ data: { projectId: project.projectId, actorId: actor.id, actorEmail: actor.email, action: `requirement.${op}`, entityType: "requirement_section", entityId: sectionId, changes: { after: { anchor: section.anchor, value: val || null } } } });
  revalidatePath(`/projects/${project.project.key}/rtm`, "layout");
}
