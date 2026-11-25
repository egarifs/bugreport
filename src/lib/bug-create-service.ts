import { BugPriority, BugSeverity, BugStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { ownModuleId } from "./modules";
import { hasPermission } from "./permissions";
import { redactSecrets } from "./redact";
import { notifyBug } from "./notify";
import { recordAuditLog } from "./user-service";
import { SANDBOX_MAX_BYTES } from "./sandbox";
import { parseTagList } from "./bug-tag-service";
import { parseBugKeys, parseLinks, parseUrl, readScreenshots, type Screenshot } from "./bug-input";
import type { checkProjectPermission } from "./authz";

type Actor = Awaited<ReturnType<typeof checkProjectPermission>>;

// Raw form values. Only the title is required: everything else has a default so logging a bug stays one line.
export type CreateBugInput = {
  title: string;
  severity?: string; // blank = Medium
  priority?: string; // reviewers only, others are ignored
  moduleId?: string | null; // blank = triage fills it in
  description?: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  environment?: string;
  appVersion?: string;
  jamUrl?: unknown;
  taskUrl?: unknown;
  links?: unknown;
  relatedKeys?: unknown;
  tags?: unknown;
  screenshots?: FormDataEntryValue[];
  asDraft?: boolean; // default true; a reviewer may open straight away, but only with a module
};

export const DEFAULT_SEVERITY = BugSeverity.MEDIUM;

const clean = (v?: string) => redactSecrets((v ?? "").trim());

export async function createBug(actor: Actor, projectId: string, input: CreateBugInput) {
  if (!hasPermission(actor.role, "bug.create", actor.isAdmin)) return { error: "Role Anda tidak bisa melaporkan bug." };
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { key: true, isSandbox: true } });
  const canReview = hasPermission(actor.role, "bug.review", actor.isAdmin);

  const title = clean(input.title);
  if (!title) return { error: "Isi judul bug." };
  if (title.length > 200) return { error: "Judul maksimal 200 karakter." };

  const sev = (input.severity ?? "").trim();
  if (sev && !Object.values(BugSeverity).includes(sev as BugSeverity)) return { error: "Severity tidak valid." };
  const severity = (sev || DEFAULT_SEVERITY) as BugSeverity;
  // Only reviewers set priority; reporters' value is ignored.
  const priority = canReview && Object.values(BugPriority).includes(input.priority as BugPriority) ? (input.priority as BugPriority) : BugPriority.NORMAL;
  const moduleId = input.moduleId ? await ownModuleId(projectId, input.moduleId) : null;

  const asDraft = input.asDraft ?? true;
  if (!asDraft && !(canReview && moduleId)) {
    return { error: canReview ? "Pilih modul untuk langsung Open, atau simpan sebagai Draft." : "Hanya reviewer yang bisa langsung membuka bug." };
  }
  const status = asDraft ? BugStatus.DRAFT : BugStatus.OPEN;

  let jamUrl: string | null, taskUrl: string | null, links: string[], relatedKeys: string[], tagNames: string[], shots: Screenshot[];
  try {
    jamUrl = parseUrl(input.jamUrl, "Link jam.dev");
    taskUrl = parseUrl(input.taskUrl, "Link task");
    links = parseLinks(input.links);
    relatedKeys = parseBugKeys(input.relatedKeys);
    tagNames = parseTagList(input.tags);
    shots = await readScreenshots(input.screenshots ?? [], project.isSandbox ? SANDBOX_MAX_BYTES : undefined);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const related = relatedKeys.length ? await prisma.bug.findMany({ where: { projectId, key: { in: relatedKeys } }, select: { id: true, key: true } }) : [];
  const missing = relatedKeys.filter((k) => !related.some((r) => r.key === k));
  if (missing.length) return { error: `Bug ${missing.join(", ")} tidak ada di project ini.` };

  const dir = path.join(process.cwd(), "uploads", project.key, "attachments");
  const stored = shots.map((s) => ({ ...s, storedName: `${randomUUID()}.${s.ext}` }));
  if (stored.length) await fs.mkdir(dir, { recursive: true });
  await Promise.all(stored.map((s) => fs.writeFile(path.join(dir, s.storedName), s.bytes)));

  let bug;
  try {
    bug = await prisma.$transaction(async (tx) => {
      const { bugSeq: number } = await tx.project.update({ where: { id: projectId }, data: { bugSeq: { increment: 1 } }, select: { bugSeq: true } });
      return tx.bug.create({
        data: {
          projectId, key: `${project.key}-${number}`, number, title, moduleId, severity, priority, status,
          environment: clean(input.environment),
          appVersion: clean(input.appVersion) || null,
          description: clean(input.description),
          stepsToReproduce: clean(input.stepsToReproduce),
          expectedResult: clean(input.expectedResult),
          actualResult: clean(input.actualResult),
          jamUrl, taskUrl, links,
          related: { connect: related.map((r) => ({ id: r.id })) },
          tags: { connectOrCreate: tagNames.map((name) => ({ where: { projectId_name: { projectId, name } }, create: { projectId, name } })) },
          reporterId: actor.id,
          attachments: { create: stored.map((s) => ({ fileName: s.name, storedName: s.storedName, fileSize: s.bytes.length, mimeType: s.mime })) },
        },
      });
    });
  } catch (e) {
    // No orphan files when the DB write fails.
    await Promise.all(stored.map((s) => fs.rm(path.join(dir, s.storedName), { force: true })));
    throw e;
  }

  await recordAuditLog({
    projectId, actorId: actor.id, actorEmail: actor.email, action: "bug.create", entityType: "bug", entityId: bug.id,
    changes: { after: { key: bug.key, status, severity, title, screenshots: stored.length, related: relatedKeys, tags: tagNames } },
  });
  if (status === BugStatus.DRAFT) await notifyBug(bug.id, actor, { kind: "draft", source: "form" });
  return { ok: `${bug.key} dibuat.`, key: bug.key, number: bug.number };
}
