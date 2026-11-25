"use server";

import { redirect } from "next/navigation";
import { requireProjectPermission } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { createBug } from "@/lib/bug-create-service";
import type { QuickBugResult } from "./quick-bug-form";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// Thin entry point: authenticate, authorize, delegate. projectId is client-visible and re-checked by authz.
export async function createBugAction(projectId: string, _prev: QuickBugResult, fd: FormData): Promise<QuickBugResult> {
  const actor = await requireProjectPermission(projectId, "bug.create");
  const res = await createBug(actor, projectId, {
    title: str(fd, "title"),
    severity: str(fd, "severity"),
    priority: str(fd, "priority"),
    moduleId: str(fd, "moduleId") || null,
    description: str(fd, "description"),
    stepsToReproduce: str(fd, "stepsToReproduce"),
    expectedResult: str(fd, "expectedResult"),
    actualResult: str(fd, "actualResult"),
    environment: str(fd, "environment"),
    appVersion: str(fd, "appVersion"),
    jamUrl: fd.get("jamUrl"),
    taskUrl: fd.get("taskUrl"),
    links: fd.get("links"),
    relatedKeys: fd.get("relatedKeys"),
    tags: fd.get("tags"),
    screenshots: fd.getAll("screenshots"),
    asDraft: fd.get("openNow") !== "true",
  });
  if ("error" in res && res.error) return { error: res.error };
  if (fd.get("intent") === "open" && "number" in res) {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { key: true } });
    redirect(`/projects/${project.key}/bugs/${res.number}`);
  }
  return res;
}
