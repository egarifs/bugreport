import { prisma } from "@/lib/db";
import { BugStatus, CommentType, ProjectRole } from "@prisma/client";
import { recordAuditLog } from "@/lib/user-service";

export const MERGE_UNDO_WINDOW_MS = 10 * 60 * 1000; // 10 minutes (AC-BUG-09)

export interface MergeActor {
  id: string;
  email: string;
  role: ProjectRole | null;
  isAdmin: boolean;
}

export interface MergeDuplicateOptions {
  movePublicComments?: boolean;
  moveAttachments?: boolean;
  addCoReporter?: boolean;
  copyStepsAsComment?: boolean;
}

export interface MergeSnapshot {
  sourceBugId: string;
  sourceKey: string;
  targetBugId: string;
  targetKey: string;
  previousStatus: BugStatus;
  movedCommentIds: string[];
  movedAttachmentIds: string[];
  coReporterId?: string | null;
  copiedCommentId?: string | null;
}

export function canMergeBug(role: ProjectRole | null, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  // Only QA and Admin can review and merge duplicates (AC-BUG-08)
  return role === ProjectRole.QA;
}

export async function resolveTargetBug(projectId: string, rawTargetKeyOrId: string) {
  const trimmed = rawTargetKeyOrId.trim();
  const target = await prisma.bug.findFirst({
    where: {
      projectId,
      OR: [
        { id: trimmed },
        { key: { equals: trimmed, mode: "insensitive" } },
      ],
    },
    include: { duplicateOf: true },
  });

  if (!target) return null;

  // AC-BUG-10: Cannot chain duplicates. If target is already DUPLICATE, resolve to parent.
  if (target.status === BugStatus.DUPLICATE && target.duplicateOf) {
    return target.duplicateOf;
  }

  return target;
}

export async function mergeDuplicateBug(
  projectId: string,
  sourceBugId: string,
  targetKeyOrId: string,
  actor: MergeActor,
  options: MergeDuplicateOptions = {}
) {
  if (!canMergeBug(actor.role, actor.isAdmin)) {
    throw new Error("Hanya QA atau Admin yang berhak menandai duplikat dan menggabungkan.");
  }

  const {
    movePublicComments = true,
    moveAttachments = true,
    addCoReporter = true,
    copyStepsAsComment = false,
  } = options;

  const sourceBug = await prisma.bug.findFirst({
    where: { id: sourceBugId, projectId },
    include: {
      comments: { where: { type: CommentType.PUBLIC } },
      attachments: true,
      reporter: true,
    },
  });

  if (!sourceBug) {
    throw new Error("Bug sumber tidak ditemukan.");
  }

  const targetBug = await resolveTargetBug(projectId, targetKeyOrId);
  if (!targetBug) {
    throw new Error("Bug target tidak ditemukan di proyek ini.");
  }

  if (targetBug.id === sourceBug.id) {
    throw new Error("Tidak bisa menggabungkan bug ke dirinya sendiri (AC-BUG-10).");
  }

  // Execute merge in transaction
  const snapshot = await prisma.$transaction(async (tx) => {
    let movedCommentIds: string[] = [];
    let movedAttachmentIds: string[] = [];
    let coReporterId: string | null = null;
    let copiedCommentId: string | null = null;

    if (movePublicComments && sourceBug.comments.length > 0) {
      movedCommentIds = sourceBug.comments.map((c) => c.id);
      await tx.bugComment.updateMany({
        where: { id: { in: movedCommentIds } },
        data: { bugId: targetBug.id },
      });
    }

    if (moveAttachments && sourceBug.attachments.length > 0) {
      movedAttachmentIds = sourceBug.attachments.map((a) => a.id);
      await tx.bugAttachment.updateMany({
        where: { id: { in: movedAttachmentIds } },
        data: { bugId: targetBug.id },
      });
    }

    if (addCoReporter) {
      const coReporter = await tx.bugCoReporter.upsert({
        where: {
          bugId_userId_sourceBugId: {
            bugId: targetBug.id,
            userId: sourceBug.reporterId,
            sourceBugId: sourceBug.id,
          },
        },
        create: {
          bugId: targetBug.id,
          userId: sourceBug.reporterId,
          sourceBugId: sourceBug.id,
        },
        update: {},
      });
      coReporterId = coReporter.id;
    }

    if (copyStepsAsComment && sourceBug.stepsToReproduce.trim()) {
      const comment = await tx.bugComment.create({
        data: {
          bugId: targetBug.id,
          authorId: actor.id,
          type: CommentType.PUBLIC,
          body: `[Langkah reproduksi dari duplikat ${sourceBug.key}]\n${sourceBug.stepsToReproduce}`,
        },
      });
      copiedCommentId = comment.id;
    }

    await tx.bug.update({
      where: { id: sourceBug.id },
      data: {
        status: BugStatus.DUPLICATE,
        duplicateOfId: targetBug.id,
      },
    });

    const mergeData: MergeSnapshot = {
      sourceBugId: sourceBug.id,
      sourceKey: sourceBug.key,
      targetBugId: targetBug.id,
      targetKey: targetBug.key,
      previousStatus: sourceBug.status,
      movedCommentIds,
      movedAttachmentIds,
      coReporterId,
      copiedCommentId,
    };

    return mergeData;
  });

  await recordAuditLog({
    projectId,
    actorId: actor.id,
    actorEmail: actor.email,
    action: "bug.merge_duplicate",
    entityType: "bug",
    entityId: sourceBug.id,
    changes: {
      before: snapshot as unknown as Record<string, unknown>,
      after: { targetKey: targetBug.key, sourceKey: sourceBug.key },
    },
  });

  return { success: true, targetKey: targetBug.key, snapshot };
}

export async function getMergeUndoStatus(sourceBugId: string) {
  const latestMerge = await prisma.auditLog.findFirst({
    where: {
      action: "bug.merge_duplicate",
      entityType: "bug",
      entityId: sourceBugId,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latestMerge) return { canUndo: false, remainingMs: 0 };

  const elapsed = Date.now() - latestMerge.createdAt.getTime();
  const remainingMs = Math.max(0, MERGE_UNDO_WINDOW_MS - elapsed);
  const canUndo = remainingMs > 0;

  const changes = latestMerge.changes as {
    before?: MergeSnapshot;
    after?: { targetKey?: string; sourceKey?: string };
  } | null;

  return {
    canUndo,
    remainingMs,
    targetKey: changes?.after?.targetKey ?? changes?.before?.targetKey,
    auditId: latestMerge.id,
    snapshot: changes?.before,
  };
}

export async function unmergeDuplicateBug(
  projectId: string,
  sourceBugId: string,
  actor: MergeActor
) {
  if (!canMergeBug(actor.role, actor.isAdmin)) {
    throw new Error("Hanya QA atau Admin yang berhak membatalkan penggabungan.");
  }

  const undoStatus = await getMergeUndoStatus(sourceBugId);
  if (!undoStatus.canUndo || !undoStatus.snapshot) {
    throw new Error("Batas waktu pembatalan 10 menit telah berakhir atau tidak ada aksi merge.");
  }

  const { snapshot, targetKey } = undoStatus;

  await prisma.$transaction(async (tx) => {
    // 1. Return moved comments
    if (snapshot.movedCommentIds.length > 0) {
      await tx.bugComment.updateMany({
        where: { id: { in: snapshot.movedCommentIds } },
        data: { bugId: snapshot.sourceBugId },
      });
    }

    // 2. Return moved attachments
    if (snapshot.movedAttachmentIds.length > 0) {
      await tx.bugAttachment.updateMany({
        where: { id: { in: snapshot.movedAttachmentIds } },
        data: { bugId: snapshot.sourceBugId },
      });
    }

    // 3. Remove co-reporter record
    if (snapshot.coReporterId) {
      await tx.bugCoReporter.deleteMany({
        where: { id: snapshot.coReporterId },
      });
    }

    // 4. Remove copied comment
    if (snapshot.copiedCommentId) {
      await tx.bugComment.deleteMany({
        where: { id: snapshot.copiedCommentId },
      });
    }

    // 5. Restore previous bug status and clear duplicateOfId
    await tx.bug.update({
      where: { id: snapshot.sourceBugId },
      data: {
        status: snapshot.previousStatus,
        duplicateOfId: null,
      },
    });
  });

  await recordAuditLog({
    projectId,
    actorId: actor.id,
    actorEmail: actor.email,
    action: "bug.unmerge_duplicate",
    entityType: "bug",
    entityId: sourceBugId,
    changes: {
      before: { targetKey, sourceBugId },
      after: { restoredStatus: snapshot.previousStatus },
    },
  });

  return { success: true, restoredStatus: snapshot.previousStatus };
}
