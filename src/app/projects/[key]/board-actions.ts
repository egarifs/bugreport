"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { moveBugStatus } from "@/lib/bug-move-service";
import { BugStatus } from "@prisma/client";

// Board drag / "Pindah ke" menu. Public endpoint: membership and per-transition permission are re-checked server-side.
export async function moveBugAction(projectKey: string, bugId: string, target: string) {
  const project = await prisma.project.findUnique({ where: { key: String(projectKey).toUpperCase() }, select: { id: true, key: true } });
  if (!project) return { error: "Project tidak ditemukan." };
  const actor = await requireProjectPermission(project.id, "project.read");
  const status = Object.values(BugStatus).find((s) => s === target);
  if (!status) return { error: "Status tujuan tidak valid." };
  const res = await moveBugStatus(actor, project.id, String(bugId), status);
  if ("ok" in res) revalidatePath(`/projects/${project.key}`);
  return res;
}
