"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { createSavedView, deleteSavedView } from "@/lib/saved-view-service";

async function scope(projectKey: string) {
  const project = await prisma.project.findUnique({ where: { key: String(projectKey).toUpperCase() }, select: { id: true, key: true } });
  if (!project) return null;
  return { project, actor: await requireProjectPermission(project.id, "project.read") };
}

export async function saveViewAction(projectKey: string, name: string, query: string, share: boolean) {
  const s = await scope(projectKey);
  if (!s) return { error: "Project tidak ditemukan." };
  const res = await createSavedView(s.actor, s.project.id, { name: String(name), query: String(query).slice(0, 2000), share: Boolean(share) });
  if ("ok" in res) revalidatePath(`/projects/${s.project.key}`);
  return res;
}

export async function deleteViewAction(projectKey: string, id: string) {
  const s = await scope(projectKey);
  if (!s) return { error: "Project tidak ditemukan." };
  const res = await deleteSavedView(s.actor, s.project.id, String(id));
  if ("ok" in res) revalidatePath(`/projects/${s.project.key}`);
  return res;
}
