"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { summaryData } from "@/lib/stlc-service";
import type { Prisma, StlcKind } from "@prisma/client";

const KINDS: StlcKind[] = ["TEST_PLAN", "TEST_SUMMARY", "RELEASE_NOTES"];
const TEXT_KEYS = ["scope", "approach", "environment", "entry", "exit", "risk", "schedule", "deviations", "recommendation"];
const clip = (v: FormDataEntryValue | null, n = 4000) => String(v ?? "").trim().slice(0, n);

async function load(id: string, perm: "doc.manage" | "doc.approve") {
  const doc = await prisma.stlcDoc.findUnique({ where: { id }, include: { project: { select: { key: true } } } });
  if (!doc) throw new Error("Not found");
  const actor = await requireProjectPermission(doc.projectId, perm);
  return { doc, actor };
}
const audit = (projectId: string, actor: { id: string; email: string }, action: string, id: string, after: Prisma.InputJsonValue) =>
  prisma.auditLog.create({ data: { projectId, actorId: actor.id, actorEmail: actor.email, action, entityType: "stlc_doc", entityId: id, changes: { after } } });

export async function createStlcDoc(projectId: string, projectKey: string, formData: FormData): Promise<void> {
  const actor = await requireProjectPermission(projectId, "doc.manage");
  const kind = String(formData.get("kind")) as StlcKind;
  if (!KINDS.includes(kind)) return;
  const title = clip(formData.get("title"), 120);
  const releaseVersion = clip(formData.get("releaseVersion"), 40) || null;
  let sprintId: string | null = null;
  if (kind === "TEST_SUMMARY") {
    const sp = await prisma.sprint.findFirst({ where: { id: String(formData.get("sprintId") ?? ""), projectId }, select: { id: true } });
    if (!sp) return;
    sprintId = sp.id;
  }
  if (!title) return;
  const doc = await prisma.stlcDoc.create({ data: { projectId, kind, title, releaseVersion, sprintId, createdById: actor.id } });
  await audit(projectId, actor, "stlc.create", doc.id, { kind, title });
  redirect(`/projects/${projectKey}/stlc/${doc.id}`);
}

export async function saveStlcDoc(id: string, formData: FormData): Promise<void> {
  const { doc, actor } = await load(id, "doc.manage");
  if (doc.status === "FINAL") return;
  const body = { ...(doc.body as Record<string, unknown>) };
  for (const k of TEXT_KEYS) if (formData.has(k)) body[k] = clip(formData.get(k));
  if (doc.kind === "RELEASE_NOTES") {
    const titles: Record<string, string> = {};
    for (const [k, v] of formData.entries()) if (k.startsWith("title:") && String(v).trim()) titles[k.slice(6, 40)] = clip(v, 200);
    if (Object.keys(titles).length) body.titles = titles; // hanya tampilan Eksternal yang mengirim judul
  }
  await prisma.stlcDoc.update({ where: { id }, data: { body: body as Prisma.InputJsonValue, ...(doc.kind === "TEST_PLAN" && doc.status === "APPROVED" ? { status: "DRAFT", approvedAt: null, approvedById: null } : {}) } });
  await audit(doc.projectId, actor, "stlc.save", id, { kind: doc.kind });
  revalidatePath(`/projects/${doc.project.key}/stlc/${id}`);
}

export async function approveStlcDoc(id: string): Promise<void> {
  const { doc, actor } = await load(id, "doc.approve");
  if (doc.kind !== "TEST_PLAN" || doc.status !== "DRAFT") return;
  await prisma.stlcDoc.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: actor.id } });
  await audit(doc.projectId, actor, "stlc.approve", id, { title: doc.title });
  revalidatePath(`/projects/${doc.project.key}/stlc/${id}`);
}

/** Finalkan Test Summary / Release notes: membekukan angka (snapshot). Setelah itu tidak bisa diubah. */
export async function finalizeStlcDoc(id: string): Promise<void> {
  const { doc, actor } = await load(id, "doc.manage");
  if (doc.kind === "TEST_PLAN" || doc.status === "FINAL") return;
  let snapshot: Prisma.InputJsonValue | undefined;
  if (doc.kind === "TEST_SUMMARY" && doc.sprintId) {
    const sprint = await prisma.sprint.findUnique({ where: { id: doc.sprintId } });
    if (sprint) snapshot = await summaryData(doc.projectId, sprint);
  }
  await prisma.stlcDoc.update({ where: { id }, data: { status: "FINAL", finalizedAt: new Date(), finalizedById: actor.id, ...(snapshot ? { snapshot } : {}) } });
  await audit(doc.projectId, actor, "stlc.finalize", id, { kind: doc.kind });
  revalidatePath(`/projects/${doc.project.key}/stlc/${id}`);
}
