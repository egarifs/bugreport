"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { addBugTag, removeBugTag } from "@/lib/bug-tag-service";
import type { ActionResult } from "@/components/ui/action-form";

async function scope(projectKey: string) {
  const project = await prisma.project.findUnique({ where: { key: String(projectKey).toUpperCase() }, select: { id: true, key: true } });
  if (!project) return null;
  return { project, actor: await requireProjectPermission(project.id, "project.read") };
}

export async function addTagAction(projectKey: string, bugId: string, bugNumber: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const s = await scope(projectKey);
  if (!s) return { error: "Project tidak ditemukan." };
  const res = await addBugTag(s.actor, s.project.id, String(bugId), String(formData.get("tag") ?? ""));
  if ("ok" in res) revalidatePath(`/projects/${s.project.key}/bugs/${bugNumber}`);
  return res;
}

export async function removeTagAction(projectKey: string, bugId: string, bugNumber: number, tagId: string): Promise<void> {
  const s = await scope(projectKey);
  if (!s) return;
  const res = await removeBugTag(s.actor, s.project.id, String(bugId), String(tagId));
  if ("ok" in res) revalidatePath(`/projects/${s.project.key}/bugs/${bugNumber}`);
}
