"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProjectPermission } from "@/lib/authz";
import type { ActionResult } from "@/components/ui/action-form";
import {
  closeRun, createBugDraftFromTestRunItem, linkBugToItem, logAttempt, reopenRun, updateAllItemVersions, updateItemVersion,
} from "@/lib/testrun-service";

const str = (f: FormData, k: string) => ((f.get(k) as string) ?? "").trim();

async function refresh(projectId: string, runId?: string) {
  const { key } = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { key: true } });
  revalidatePath(`/projects/${key}/test-runs`, "layout");
  return { key, runId };
}

// projectId comes from the client: every action re-checks permission against it in the DB.
export async function logAttemptAction(projectId: string, itemId: string, _p: ActionResult, f: FormData): Promise<ActionResult> {
  const actor = await requireProjectPermission(projectId, "testrun.execute");
  const res = await logAttempt(actor, projectId, itemId, {
    result: str(f, "result"), actualResult: str(f, "actualResult"), notes: str(f, "notes"), build: str(f, "build"), evidenceUrl: str(f, "evidenceUrl"),
  });
  await refresh(projectId);
  return res;
}

export async function createBugAction(projectId: string, itemId: string): Promise<ActionResult> {
  const actor = await requireProjectPermission(projectId, "bug.create");
  const ok = await prisma.testRunItem.findFirst({ where: { id: itemId, testRun: { projectId } }, select: { id: true } });
  if (!ok) return { error: "Item tidak ditemukan." };
  const r = await createBugDraftFromTestRunItem({ testRunItemId: itemId, actorId: actor.id, actorEmail: actor.email });
  await refresh(projectId);
  return { ok: r.created ? `${r.bug.key} dibuat sebagai draft.` : `${r.bug.key} sudah ada untuk percobaan ini.` };
}

export async function linkBugAction(projectId: string, itemId: string, _p: ActionResult, f: FormData): Promise<ActionResult> {
  await requireProjectPermission(projectId, "testrun.execute");
  const res = await linkBugToItem(projectId, itemId, str(f, "bugKey"));
  await refresh(projectId);
  return res;
}

export async function updateVersionAction(projectId: string, itemId: string): Promise<ActionResult> {
  const actor = await requireProjectPermission(projectId, "testrun.execute");
  const res = await updateItemVersion(actor, projectId, itemId);
  await refresh(projectId);
  return res;
}

export async function updateAllVersionsAction(projectId: string, runId: string): Promise<ActionResult> {
  const actor = await requireProjectPermission(projectId, "testrun.execute");
  const res = await updateAllItemVersions(actor, projectId, runId);
  await refresh(projectId);
  return res;
}

export async function closeRunAction(projectId: string, runId: string, _p: ActionResult, f: FormData): Promise<ActionResult> {
  const actor = await requireProjectPermission(projectId, "testrun.execute");
  const resolutions: Record<string, { result: string; reason?: string }> = {};
  for (const [k, v] of f.entries()) {
    if (k.startsWith("res_")) resolutions[k.slice(4)] = { result: String(v), reason: str(f, `reason_${k.slice(4)}`) };
  }
  const res = await closeRun(actor, projectId, runId, { decision: str(f, "decision"), note: str(f, "note"), resolutions });
  await refresh(projectId);
  return res;
}

export async function reopenRunAction(projectId: string, runId: string): Promise<ActionResult> {
  const actor = await requireProjectPermission(projectId, "testcase.manage");
  const res = await reopenRun(actor, projectId, runId);
  await refresh(projectId);
  return res;
}

// AC-BUG-05: one-click "Catat percobaan Lolos" from the bug page, in the build the bug was fixed in.
export async function rerunPassFromBugAction(projectId: string, itemId: string): Promise<ActionResult> {
  const actor = await requireProjectPermission(projectId, "testrun.execute");
  const item = await prisma.testRunItem.findFirst({
    where: { id: itemId, needsRerun: true, testRun: { projectId } },
    select: { rerunBuild: true, rerunBug: { select: { key: true, number: true } } },
  });
  if (!item) return { error: "Item ini sudah tidak menunggu re-run." };
  const res = await logAttempt(actor, projectId, itemId, { result: "PASS", build: item.rerunBuild ?? undefined, notes: item.rerunBug ? `Retest ${item.rerunBug.key}` : undefined });
  const { key } = await refresh(projectId);
  revalidatePath(`/projects/${key}/bugs`, "layout");
  return res;
}
