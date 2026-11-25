"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import { triageBug } from "@/lib/triage-service";
import { importBugs, previewBugImport, type ImportPreviewResult } from "@/lib/bug-import-service";
import type { ActionResult } from "@/components/ui/action-form";

// Thin entry points: authenticate, authorize, delegate to a service, refresh the page.
async function projectOf(key: string) {
  const project = await prisma.project.findUnique({ where: { key: String(key).toUpperCase() }, select: { id: true, key: true } });
  if (!project) throw new Error("Project tidak ditemukan.");
  return project;
}

export async function triageAction(projectKey: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const project = await projectOf(projectKey);
  const actor = await requireProjectPermission(project.id, "bug.review");
  const intent = formData.get("intent");
  const res = await triageBug(actor, project.id, String(formData.get("bugId")), {
    severity: String(formData.get("severity") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    moduleId: String(formData.get("moduleId") ?? ""),
    assigneeId: String(formData.get("assigneeId") ?? ""),
    accept: intent === "accept",
    reject: intent === "reject",
  });
  revalidatePath(`/projects/${project.key}`);
  if ("ok" in res && (intent === "accept" || intent === "reject")) {
    redirect(`/projects/${project.key}?view=review&done=${encodeURIComponent(res.ok!)}`);
  }
  return res;
}

const fileText = async (formData: FormData) => {
  const file = formData.get("file");
  return file instanceof File && file.size > 0 ? file.text() : "";
};

export async function previewImportAction(_prev: ImportPreviewResult | null, formData: FormData): Promise<ImportPreviewResult> {
  const project = await prisma.project.findUnique({ where: { key: String(formData.get("projectKey") ?? "").toUpperCase() }, select: { id: true } });
  if (!project) return { error: "Project tidak ditemukan." };
  await requireProjectPermission(project.id, "bug.create");
  return previewBugImport(project.id, await fileText(formData));
}

export async function importBugsAction(projectKey: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const project = await projectOf(projectKey);
  const actor = await requireProjectPermission(project.id, "bug.create");
  const res = await importBugs(actor.id, project.id, project.key, await fileText(formData));
  if ("ok" in res) revalidatePath(`/projects/${project.key}`);
  return res;
}
