import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { BugStatus, CommentType, ProjectRole, UserStatus } from "@prisma/client";
import {
  mergeDuplicateBug,
  unmergeDuplicateBug,
  getMergeUndoStatus,
  resolveTargetBug,
} from "./merge-duplicate-service";

test("AC-BUG-10: Cannot self-merge or chain duplicates", async () => {
  const admin = await prisma.user.upsert({
    where: { email: "admin-merge@example.test" },
    create: { email: "admin-merge@example.test", name: "Admin Merge", status: UserStatus.ACTIVE, isAdmin: true },
    update: {},
  });

  const proj = await prisma.project.upsert({
    where: { key: "MERGETEST" },
    create: { key: "MERGETEST", name: "Merge Test Project", isTest: true },
    update: {},
  });

  const b1 = await prisma.bug.create({
    data: {
      projectId: proj.id,
      number: 1,
      key: "MERGETEST-1",
      title: "Parent Bug 1",
      status: BugStatus.OPEN,
      severity: "MEDIUM",
      reporterId: admin.id,
    },
  });

  const b2 = await prisma.bug.create({
    data: {
      projectId: proj.id,
      number: 2,
      key: "MERGETEST-2",
      title: "Duplicate of 1",
      status: BugStatus.DUPLICATE,
      duplicateOfId: b1.id,
      severity: "MEDIUM",
      reporterId: admin.id,
    },
  });

  await prisma.bug.create({
    data: {
      projectId: proj.id,
      number: 3,
      key: "MERGETEST-3",
      title: "Third Bug Candidate",
      status: BugStatus.DRAFT,
      severity: "MEDIUM",
      reporterId: admin.id,
    },
  });

  const actor = { id: admin.id, email: admin.email, role: ProjectRole.QA, isAdmin: true };

  // 1. Cannot self-merge
  await assert.rejects(
    async () => {
      await mergeDuplicateBug(proj.id, b1.id, b1.key, actor);
    },
    /Tidak bisa menggabungkan bug ke dirinya sendiri/
  );

  // 2. Chained target resolves to parent bug
  const resolved = await resolveTargetBug(proj.id, b2.key);
  assert.equal(resolved?.id, b1.id, "Targeting b2 (which is DUPLICATE) should resolve to b1 (the parent)");

  // Cleanup
  await prisma.bug.deleteMany({ where: { projectId: proj.id } });
  await prisma.project.delete({ where: { id: proj.id } });
});

test("AC-BUG-08 & AC-BUG-09: Merge and Undo duplicate within 10 minutes", async () => {
  const qaUser = await prisma.user.upsert({
    where: { email: "qa-merge@example.test" },
    create: { email: "qa-merge@example.test", name: "QA Merge", status: UserStatus.ACTIVE },
    update: {},
  });
  const clientUser = await prisma.user.upsert({
    where: { email: "client-merge@example.test" },
    create: { email: "client-merge@example.test", name: "Client Merge", status: UserStatus.ACTIVE },
    update: {},
  });

  const proj = await prisma.project.upsert({
    where: { key: "MERGETEST2" },
    create: { key: "MERGETEST2", name: "Merge Test 2", isTest: true },
    update: {},
  });

  const parentBug = await prisma.bug.create({
    data: {
      projectId: proj.id,
      number: 10,
      key: "MERGETEST2-10",
      title: "Main bug issue",
      status: BugStatus.OPEN,
      severity: "HIGH",
      reporterId: qaUser.id,
    },
  });

  const sourceBug = await prisma.bug.create({
    data: {
      projectId: proj.id,
      number: 11,
      key: "MERGETEST2-11",
      title: "Duplicate report by client",
      status: BugStatus.DRAFT,
      severity: "HIGH",
      stepsToReproduce: "1. Click menu\n2. See error",
      reporterId: clientUser.id,
    },
  });

  // Add 1 comment and 1 attachment to source
  const comment = await prisma.bugComment.create({
    data: {
      bugId: sourceBug.id,
      authorId: clientUser.id,
      body: "Initial observation",
      type: CommentType.PUBLIC,
    },
  });

  const attachment = await prisma.bugAttachment.create({
    data: {
      bugId: sourceBug.id,
      fileName: "screen.png",
      storedName: "stored-screen-test.png",
      fileSize: 1024,
      mimeType: "image/png",
    },
  });

  const qaActor = { id: qaUser.id, email: qaUser.email, role: ProjectRole.QA, isAdmin: false };
  const vendorActor = { id: clientUser.id, email: clientUser.email, role: ProjectRole.VENDOR, isAdmin: false };

  // Vendor denied
  await assert.rejects(
    async () => {
      await mergeDuplicateBug(proj.id, sourceBug.id, parentBug.key, vendorActor);
    },
    /Hanya QA atau Admin/
  );

  // QA merges
  const mergeResult = await mergeDuplicateBug(proj.id, sourceBug.id, parentBug.key, qaActor, {
    movePublicComments: true,
    moveAttachments: true,
    addCoReporter: true,
    copyStepsAsComment: true,
  });

  assert.equal(mergeResult.success, true);
  assert.equal(mergeResult.targetKey, parentBug.key);

  // Check state after merge
  const sourceAfter = await prisma.bug.findUniqueOrThrow({ where: { id: sourceBug.id } });
  assert.equal(sourceAfter.status, BugStatus.DUPLICATE);
  assert.equal(sourceAfter.duplicateOfId, parentBug.id);

  // Comment & attachment moved to parent
  const commentAfter = await prisma.bugComment.findUniqueOrThrow({ where: { id: comment.id } });
  assert.equal(commentAfter.bugId, parentBug.id, "Public comment moved to parent");

  const attachAfter = await prisma.bugAttachment.findUniqueOrThrow({ where: { id: attachment.id } });
  assert.equal(attachAfter.bugId, parentBug.id, "Attachment moved to parent");

  // CoReporter created
  const coRep = await prisma.bugCoReporter.findFirst({
    where: { bugId: parentBug.id, userId: clientUser.id, sourceBugId: sourceBug.id },
  });
  assert.ok(coRep, "Client recorded in BugCoReporter");

  // Check undo status
  const undoStatus = await getMergeUndoStatus(sourceBug.id);
  assert.equal(undoStatus.canUndo, true);
  assert.ok(undoStatus.remainingMs > 0);

  // Execute undo
  const undoResult = await unmergeDuplicateBug(proj.id, sourceBug.id, qaActor);
  assert.equal(undoResult.success, true);
  assert.equal(undoResult.restoredStatus, BugStatus.DRAFT);

  // Check restored state
  const sourceRestored = await prisma.bug.findUniqueOrThrow({ where: { id: sourceBug.id } });
  assert.equal(sourceRestored.status, BugStatus.DRAFT);
  assert.equal(sourceRestored.duplicateOfId, null);

  const commentRestored = await prisma.bugComment.findUniqueOrThrow({ where: { id: comment.id } });
  assert.equal(commentRestored.bugId, sourceBug.id, "Comment returned to source");

  const attachRestored = await prisma.bugAttachment.findUniqueOrThrow({ where: { id: attachment.id } });
  assert.equal(attachRestored.bugId, sourceBug.id, "Attachment returned to source");

  const coRepAfter = await prisma.bugCoReporter.findFirst({
    where: { bugId: parentBug.id, userId: clientUser.id, sourceBugId: sourceBug.id },
  });
  assert.equal(coRepAfter, null, "BugCoReporter removed on undo");

  // Cleanup
  await prisma.bugAttachment.deleteMany({ where: { storedName: "stored-screen-test.png" } });
  await prisma.bugComment.deleteMany({ where: { id: comment.id } });
  await prisma.bug.deleteMany({ where: { projectId: proj.id } });
  await prisma.project.delete({ where: { id: proj.id } });
});
