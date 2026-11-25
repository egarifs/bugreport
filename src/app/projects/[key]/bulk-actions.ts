"use server";

import { revalidatePath } from "next/cache";
import { BugStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { bulkUpdateBugs, type BulkOp } from "@/lib/bug-bulk-service";

export type BulkResult = { ok?: string; error?: string } | undefined;

// Public endpoint: membership is re-checked, each bug is re-checked per rule in the service.
export async function bulkAction(projectKey: string, _prev: BulkResult, formData: FormData): Promise<BulkResult> {
  const project = await prisma.project.findUnique({ where: { key: String(projectKey).toUpperCase() }, select: { id: true, key: true } });
  if (!project) return { error: "Project tidak ditemukan." };
  const actor = await requireProjectPermission(project.id, "project.read");

  const intent = String(formData.get("intent") ?? "");
  let op: BulkOp | null = null;
  if (intent === "status") {
    const target = Object.values(BugStatus).find((s) => s === formData.get("status"));
    if (!target) return { error: "Pilih status tujuan." };
    op = { kind: "status", target };
  } else if (intent === "assign") {
    const v = String(formData.get("assignee") ?? "");
    if (!v) return { error: "Pilih assignee." };
    op = { kind: "assign", userId: v === "none" ? null : v };
  } else if (intent === "tag") {
    const name = String(formData.get("tag") ?? "");
    if (!name.trim()) return { error: "Isi nama tag." };
    op = { kind: "tag", name };
  }
  if (!op) return { error: "Aksi tidak dikenal." };

  const res = await bulkUpdateBugs(actor, project.id, formData.getAll("ids").map(String), op);
  if ("ok" in res) revalidatePath(`/projects/${project.key}`);
  return res;
}
