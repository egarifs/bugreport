import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canTransitionBug, hasPermission } from "@/lib/permissions";
import { guardBugTransition } from "@/lib/bug-transition";
import { redactSecrets } from "@/lib/redact";
import { notifyBug } from "@/lib/notify";
import { rerunPassFromBugAction } from "../../test-runs/test-run-actions";
import { flagRerunForBug } from "@/lib/testrun-service";
import { recordAuditLog } from "@/lib/user-service";
import { BugStatus, CommentType, ProjectRole } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/layout/app-shell";
import { SeverityBadge, StatusBadge, STATUS_LABEL } from "@/components/ui/bug-badges";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { activeModules, ownModuleId } from "@/lib/modules";
import { buildLabel, dueLabel, verifyBug } from "@/lib/verify-service";
import {
  canMergeBug,
  mergeDuplicateBug,
  unmergeDuplicateBug,
  getMergeUndoStatus,
} from "@/lib/merge-duplicate-service";
import { MergeDuplicateModal } from "./merge-duplicate-modal";
import { MergeUndoBanner } from "./merge-undo-banner";

export default async function BugDetailPage({
  params,
}: {
  params: Promise<{ key: string; number: string }>;
}) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; isAdmin?: boolean }
    | undefined;

  if (!user?.email || !user.id) redirect("/login");

  const { key, number } = await params;
  const num = parseInt(number, 10);
  if (isNaN(num)) notFound();

  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) {
    redirect("/projects");
  }

  const userRole: ProjectRole = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canSeeInternalNotes = hasPermission(userRole, "note.internal.read", user.isAdmin);

  const bug = await prisma.bug.findUnique({
    where: {
      projectId_number: {
        projectId: project.id,
        number: num,
      },
    },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      duplicateOf: { select: { key: true, number: true, title: true } },
      duplicates: { select: { key: true, number: true, title: true } },
      coReporters: {
        include: {
          user: { select: { name: true, email: true } },
          sourceBug: { select: { key: true } },
        },
      },
      module: { select: { name: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
      related: { select: { key: true, number: true, title: true } },
      relatedBy: { select: { key: true, number: true, title: true } },
      comments: {
        where: canSeeInternalNotes ? {} : { type: CommentType.PUBLIC },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  if (!bug) notFound();
  // Relation is stored one-way; show both directions.
  const allRelated = [...bug.related, ...bug.relatedBy].filter((r, i, a) => a.findIndex((x) => x.key === r.key) === i);

  // Audit timeline for activity
  const timeline = await prisma.auditLog.findMany({
    where: { entityType: "bug", entityId: bug.id },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const modules = await activeModules(project.id);

  const members = await prisma.projectMember.findMany({
    where: { projectId: project.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Allowed transitions from current status
  const possibleStatuses = Object.values(BugStatus).filter(
    (target) =>
      target !== bug.status &&
      canTransitionBug(bug.status, target, userRole, user.isAdmin).allowed
  );

  // AC-BUG-05: items waiting for a retest of this bug (kept after the bug closes until a PASS is logged).
  const rerunItems = await prisma.testRunItem.findMany({
    where: { rerunBugId: bug.id, needsRerun: true, testRun: { status: "IN_PROGRESS" } },
    select: { id: true, rerunBuild: true, testRunId: true, testRun: { select: { name: true } }, testCase: { select: { code: true, title: true } } },
  });
  const canRerun = hasPermission(userRole, "testrun.execute", user.isAdmin);
  const fixedIn = buildLabel(bug.fixedInVersion, bug.fixedInBuild);
  const canVerify = hasPermission(userRole, "bug.close", user.isAdmin);
  const canEditFields = hasPermission(userRole, "bug.update", user.isAdmin);
  const due = bug.dueAt ? dueLabel(bug.dueAt, bug.status) : null;
  const back = `/projects/${project.key}/bugs/${bug.number}`;
  const projectId = project.id;
  const bugId = bug.id;
  const prevFixedVersion = bug.fixedInVersion;
  const prevFixedBuild = bug.fixedInBuild;
  const prevDue = bug.dueAt?.toISOString() ?? null;

  const canMerge = canMergeBug(userRole, Boolean(user.isAdmin));
  const undoStatus = await getMergeUndoStatus(bug.id);

  const handleMergeDuplicate = async (formData: FormData): Promise<{ error?: string; success?: boolean; targetKey?: string }> => {
    "use server";
    try {
      const actor = await requireProjectPermission(projectId, "project.read");
      const targetKey = String(formData.get("targetKey") ?? "").trim();
      const movePublicComments = formData.get("movePublicComments") === "true";
      const moveAttachments = formData.get("moveAttachments") === "true";
      const addCoReporter = formData.get("addCoReporter") === "true";
      const copyStepsAsComment = formData.get("copyStepsAsComment") === "true";

      const res = await mergeDuplicateBug(projectId, bugId, targetKey, actor, {
        movePublicComments,
        moveAttachments,
        addCoReporter,
        copyStepsAsComment,
      });
      revalidatePath(back);
      return res;
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Gagal menggabungkan duplikat." };
    }
  };

  const handleUndoMerge = async (): Promise<{ error?: string; success?: boolean }> => {
    "use server";
    try {
      const actor = await requireProjectPermission(projectId, "project.read");
      const res = await unmergeDuplicateBug(projectId, bugId, actor);
      revalidatePath(back);
      return res;
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Gagal membatalkan penggabungan." };
    }
  };

  const handleVerifyPass = async (): Promise<ActionResult> => {
    "use server";
    const actor = await requireProjectPermission(projectId, "project.read");
    const res = await verifyBug(actor, projectId, bugId, "pass");
    revalidatePath(back);
    return res;
  }
  const handleVerifyFail = async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
    "use server";
    const actor = await requireProjectPermission(projectId, "project.read");
    const res = await verifyBug(actor, projectId, bugId, "fail", String(formData.get("reason") ?? ""));
    revalidatePath(back);
    return res;
  }
  const handleFields = async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
    "use server";
    const actor = await requireProjectPermission(projectId, "bug.update");
    const clean = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 80) || null;
    const dueRaw = String(formData.get("dueAt") ?? "");
    const dueAt = dueRaw ? new Date(`${dueRaw}T17:00:00+07:00`) : null; // end of working day, WIB
    if (dueAt && Number.isNaN(dueAt.getTime())) return { error: "Tanggal tenggat tidak valid." };
    const data = { fixedInVersion: clean("fixedInVersion"), fixedInBuild: clean("fixedInBuild"), dueAt };
    await prisma.bug.update({ where: { id: bugId }, data });
    await recordAuditLog({
      projectId: projectId, actorId: actor.id, actorEmail: actor.email, action: "bug.fields_update", entityType: "bug", entityId: bugId,
      changes: {
        before: { fixedInVersion: prevFixedVersion, fixedInBuild: prevFixedBuild, dueAt: prevDue },
        after: { ...data, dueAt: dueAt?.toISOString() ?? null },
      },
    });
    revalidatePath(back);
    return { ok: "Tersimpan." };
  }

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-surface border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${project.key}`}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← {project.key}
            </Link>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {bug.key}
            </span>
            <span className="font-semibold text-slate-900 text-sm truncate max-w-md">
              {bug.title}
            </span>
          </div>

        <div className="flex items-center gap-2">
          {bug.duplicates.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded border border-slate-200">
              {bug.duplicates.length} duplikat digabung
            </span>
          )}

          {canMerge && bug.status !== BugStatus.DUPLICATE && (
            <MergeDuplicateModal
              projectKey={project.key}
              sourceBug={{
                id: bug.id,
                key: bug.key,
                title: bug.title,
                reporterName: bug.reporter.name || bug.reporter.email,
                publicCommentsCount: bug.comments.filter((c) => c.type === CommentType.PUBLIC).length,
                attachmentsCount: bug.attachments.length,
                hasSteps: Boolean(bug.stepsToReproduce.trim()),
              }}
              onMergeAction={handleMergeDuplicate}
            />
          )}

          <SeverityBadge severity={bug.severity} />

          <StatusBadge status={bug.status} />
        </div>
      </header>

      {undoStatus.canUndo && undoStatus.targetKey && (
        <div className="px-6 pt-4">
          <MergeUndoBanner
            initialRemainingMs={undoStatus.remainingMs}
            targetKey={undoStatus.targetKey}
            sourceKey={bug.key}
            onUndoAction={handleUndoMerge}
          />
        </div>
      )}

      <main className="p-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Detail content & comments */}
        <div className="lg:col-span-2 space-y-6">
          {bug.status === BugStatus.READY_FOR_VERIFICATION && (
            <section aria-label="Verifikasi" className="bg-action-soft border border-action/30 rounded-lg p-4 text-sm text-slate-900 space-y-3">
              <p className="font-bold">
                {fixedIn ? `Siap diverifikasi di build ${fixedIn}` : "Siap diverifikasi"}
              </p>
              {canVerify ? (
                <>
                  <ActionForm action={handleVerifyPass} className="inline">
                    <SubmitButton pendingText="Menutup..." className="px-3 py-1.5 bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded">Lolos verifikasi</SubmitButton>
                  </ActionForm>
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-bold underline">Masih gagal…</summary>
                    <ActionForm action={handleVerifyFail} className="mt-2 space-y-2">
                      <label htmlFor="verify-reason" className="block text-xs font-medium">Alasan (wajib)</label>
                      <textarea id="verify-reason" name="reason" rows={2} required className="w-full px-2 py-1.5 border border-action/30 rounded bg-surface text-sm" />
                      <SubmitButton pendingText="Mengirim..." className="px-3 py-1.5 border border-slate-400 bg-surface hover:bg-slate-100 text-sm font-bold rounded">Buka kembali</SubmitButton>
                    </ActionForm>
                  </details>
                </>
              ) : (
                <p className="text-xs">Menunggu verifikasi QA.</p>
              )}
            </section>
          )}
          {rerunItems.length > 0 && (
            <section aria-label="Menunggu re-run" className="bg-warn-bg border border-warn-border rounded-lg p-4 text-sm text-slate-900 space-y-2">
              <p className="font-bold">↻ Perlu re-run</p>
              <ul className="space-y-2">
                {rerunItems.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-mono font-bold">{it.testCase.code}</span> {it.testCase.title}
                      <Link href={`/projects/${project.key}/test-runs/${it.testRunId}`} className="ml-2 text-link underline text-xs">{it.testRun.name}</Link>
                    </span>
                    {canRerun && (
                      <ActionForm action={rerunPassFromBugAction.bind(null, project.id, it.id)} className="inline">
                        <SubmitButton pendingText="Mencatat..." className="px-3 py-2 min-h-[44px] bg-action hover:bg-action-hover text-on-action text-xs font-bold rounded">
                          Catat percobaan Lolos untuk {it.testCase.code}
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="bg-surface border border-slate-200 rounded-lg p-6 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900 mb-4">{bug.title}</h1>

            <div className="space-y-4 text-xs">
              {bug.description && bug.description !== bug.title && (
                <div>
                  <h3 className="font-semibold text-slate-700 text-xs mb-1">Deskripsi</h3>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800 whitespace-pre-wrap">
                    {bug.description}
                  </div>
                </div>
              )}

              {bug.stepsToReproduce && (
                <div>
                  <h3 className="font-semibold text-slate-700 text-xs mb-1">Langkah Reproduksi</h3>
                  <pre className="bg-slate-50 border border-slate-200 rounded p-3 font-mono whitespace-pre-wrap text-slate-800">
                    {bug.stepsToReproduce}
                  </pre>
                </div>
              )}

              {(bug.expectedResult || bug.actualResult) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-700 text-xs mb-1">Hasil yang Diharapkan</h3>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800 whitespace-pre-wrap">
                      {bug.expectedResult || "-"}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700 text-xs mb-1">Hasil Aktual</h3>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800 whitespace-pre-wrap">
                      {bug.actualResult || "-"}
                    </div>
                  </div>
                </div>
              )}

              {bug.attachments.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-700 text-xs mb-1">Screenshot ({bug.attachments.length})</h3>
                  <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {bug.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={`/api/projects/${project.key}/attachments/${a.id}`} target="_blank" rel="noopener" className="block border border-slate-200 rounded overflow-hidden hover:ring-2 hover:ring-action">
                          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route, not optimizable */}
                          <img src={`/api/projects/${project.key}/attachments/${a.id}`} alt={a.fileName} className="w-full h-32 object-cover bg-slate-50" loading="lazy" />
                          <span className="block px-2 py-1 truncate text-slate-600">{a.fileName}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(bug.jamUrl || bug.taskUrl || bug.links.length > 0 || allRelated.length > 0) && (
                <div>
                  <h3 className="font-semibold text-slate-700 text-xs mb-1">Tautan</h3>
                  <ul className="space-y-1">
                    {bug.jamUrl && <LinkRow label="Rekaman jam.dev" href={bug.jamUrl} />}
                    {bug.taskUrl && <LinkRow label="Task" href={bug.taskUrl} />}
                    {bug.links.map((l) => <LinkRow key={l} label="Tautan" href={l} />)}
                    {allRelated.map((r) => (
                      <li key={r.key} className="flex gap-2">
                        <span className="w-28 shrink-0 text-slate-500">Terkait</span>
                        <Link href={`/projects/${project.key}/bugs/${r.number}`} className="font-mono font-bold text-action hover:underline">{r.key}</Link>
                        <span className="truncate">{r.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {bug.duplicateOf && (
                <div className="bg-warn-bg border border-warn-border rounded p-3 text-warn">
                  <span className="font-semibold">Ditandai duplikat dari:</span>{" "}
                  <Link
                    href={`/projects/${project.key}/bugs/${bug.duplicateOf.number}`}
                    className="font-mono font-bold underline"
                  >
                    {bug.duplicateOf.key}
                  </Link>{" "}
                  - {bug.duplicateOf.title}
                </div>
              )}

              {bug.reopenReason && (
                <div className="bg-bad-bg border border-bad-border rounded p-3 text-bad">
                  <span className="font-semibold">Alasan Reopen:</span> {bug.reopenReason}
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="bg-surface border border-slate-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-4">
              Komentar & Diskusi ({bug.comments.length})
            </h2>

            <div className="space-y-3 mb-6">
              {bug.comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada komentar.</p>
              ) : (
                bug.comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded text-xs border ${
                      c.type === CommentType.INTERNAL
                        ? "bg-warn-bg/50 border-warn-border"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-800">
                        {c.author.name || c.author.email}
                      </span>
                      <div className="flex items-center gap-2">
                        {c.type === CommentType.INTERNAL && (
                          <span className="text-xs font-semibold bg-warn-bg text-warn px-1.5 py-0.2 rounded">
                            Catatan Internal
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {c.createdAt.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment form */}
            <form
              action={async (formData) => {
                "use server";
                const actor = await requireProjectPermission(project.id, "bug.comment");
                const body = redactSecrets(((formData.get("body") as string) ?? "").trim());
                const type =
                  formData.get("type") === CommentType.INTERNAL &&
                  hasPermission(actor.role, "note.internal.read", actor.isAdmin)
                    ? CommentType.INTERNAL
                    : CommentType.PUBLIC;

                if (!body) return;

                await prisma.bugComment.create({
                  data: {
                    bugId: bug.id,
                    authorId: actor.id,
                    body,
                    type,
                  },
                });

                await recordAuditLog({
                  projectId: project.id,
                  actorId: actor.id,
                  actorEmail: actor.email,
                  action: "bug.comment",
                  entityType: "bug",
                  entityId: bug.id,
                  changes: { after: { type, length: body.length } },
                });
                await notifyBug(bug.id, actor, { kind: "comment", commentType: type, excerpt: body });

                revalidatePath(`/projects/${project.key}/bugs/${bug.number}`);
              }}
              className="space-y-2 text-xs"
            >
              <textarea
                name="body"
                required
                rows={3}
                placeholder="Tulis komentar atau update penanganan..."
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />

              <div className="flex items-center justify-between">
                {canSeeInternalNotes ? (
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      name="type"
                      value={CommentType.INTERNAL}
                      className="rounded"
                    />
                    <span>Internal note (tersembunyi dari Vendor/Client)</span>
                  </label>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  className="px-3 py-1.5 bg-action hover:bg-action-hover text-on-action rounded text-xs font-medium"
                >
                  Kirim Komentar
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Metadata & Actions */}
        <div className="space-y-6 text-xs">
          {/* Status transition panel */}
          <div className="bg-surface border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900">Ubah Status</h3>

            {possibleStatuses.length === 0 ? (
              <p className="text-slate-400 text-xs italic">
                Tidak ada transisi status yang dapat dilakukan oleh role Anda saat ini.
              </p>
            ) : (
              <ActionForm
                action={async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
                  "use server";
                  const actor = await requireProjectPermission(project.id, "project.read");
                  const targetStatus = formData.get("targetStatus") as BugStatus;
                  const reopenReason = (formData.get("reopenReason") as string)?.trim();
                  const appVersion = (formData.get("appVersion") as string)?.trim();
                  const duplicateOfKey = (formData.get("duplicateOfKey") as string)?.trim();

                  const check = await guardBugTransition(bug, project.id, targetStatus, actor);
                  if (!check.allowed) return { error: "Role Anda tidak bisa mengubah status ke pilihan ini." };

                  if (targetStatus === BugStatus.REOPENED && !reopenReason) {
                    return { error: "Isi alasan reopen sebelum membuka ulang bug." };
                  }

                  // Draft -> Open gate: version/build and a module from the project's master list.
                  const opening = targetStatus === BugStatus.OPEN && bug.status === BugStatus.DRAFT;
                  const moduleId = opening
                    ? await ownModuleId(project.id, (formData.get("moduleId") as string) || bug.moduleId)
                    : undefined;
                  if (opening && !(appVersion || bug.appVersion)) {
                    return { error: "Isi versi atau build sebelum membuka bug ini." };
                  }
                  if (opening && !moduleId) {
                    return { error: "Pilih modul sebelum membuka bug ini. Admin project menambah modul di Settings." };
                  }

                  // Optional duplicate link
                  let duplicateOfId: string | undefined = undefined;
                  if (duplicateOfKey) {
                    const targetBug = await prisma.bug.findFirst({
                      where: { projectId: project.id, key: duplicateOfKey.toUpperCase() },
                    });
                    if (targetBug) duplicateOfId = targetBug.id;
                  }

                  const isReopen = targetStatus === BugStatus.REOPENED;

                  await prisma.bug.update({
                    where: { id: bug.id },
                    data: {
                      status: targetStatus,
                      ...(appVersion ? { appVersion } : {}),
                      ...(moduleId ? { moduleId } : {}),
                      ...(duplicateOfId ? { duplicateOfId } : {}),
                      ...(targetStatus === BugStatus.CLOSED && bug.status === BugStatus.READY_FOR_VERIFICATION
                        ? { verifiedAt: new Date(), verifiedInBuild: fixedIn || null }
                        : {}),
                      ...(isReopen
                        ? {
                            reopenCount: { increment: 1 },
                            reopenReason,
                          }
                        : {}),
                      ...(targetStatus === BugStatus.OPEN && bug.status === BugStatus.DRAFT
                        ? {
                            reviewedById: actor.id,
                            reviewedAt: new Date(),
                          }
                        : {}),
                    },
                  });

                  await recordAuditLog({
                    projectId: project.id,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    action: "bug.status_change",
                    entityType: "bug",
                    entityId: bug.id,
                    changes: {
                      before: { status: bug.status },
                      after: { status: targetStatus, reopenReason, duplicateOfKey, appVersion },
                    },
                  });
                  await notifyBug(bug.id, actor, { kind: "status", from: bug.status, to: targetStatus });
                  if (targetStatus === BugStatus.READY_FOR_VERIFICATION) await flagRerunForBug(bug.id, actor);

                  revalidatePath(`/projects/${project.key}/bugs/${bug.number}`);
                  return { ok: `Status diubah ke ${STATUS_LABEL[targetStatus]}.` };
                }}
                className="space-y-2"
              >
                <select
                  name="targetStatus"
                  required
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-xs font-medium"
                >
                  {possibleStatuses.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>

                {bug.status === BugStatus.DRAFT && (
                  <div>
                    <label htmlFor="moduleId" className="block text-xs text-slate-600 mb-0.5">
                      Modul (wajib untuk Open)
                    </label>
                    {modules.length === 0 ? (
                      <p className="text-xs text-sev-blocker">Project belum punya modul. Admin perlu menambahkannya di Settings.</p>
                    ) : (
                      <select id="moduleId" name="moduleId" defaultValue={bug.moduleId ?? ""} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
                        <option value="">Pilih modul</option>
                        {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                  </div>
                )}

                {bug.status === BugStatus.DRAFT && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">
                      Versi / Build Rilis (wajib untuk Open) *
                    </label>
                    <input
                      type="text"
                      name="appVersion"
                      defaultValue={bug.appVersion ?? ""}
                      placeholder="Contoh: v1.0.4-staging"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">
                    Alasan Reopen (wajib jika Reopened)
                  </label>
                  <input
                    type="text"
                    name="reopenReason"
                    placeholder="Contoh: Bug masih terjadi di branch staging..."
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">
                    Tautkan Duplikat (opsional, misal CRM-1)
                  </label>
                  <input
                    type="text"
                    name="duplicateOfKey"
                    defaultValue={bug.duplicateOf?.key ?? ""}
                    placeholder="Contoh: CRM-1"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs uppercase font-mono"
                  />
                </div>

                <SubmitButton pendingText="Menyimpan..." className="w-full py-2 bg-action hover:bg-action-hover text-on-action font-bold rounded text-sm">
                  Ubah status
                </SubmitButton>
              </ActionForm>
            )}
          </div>

          {/* Assignment & Details */}
          <div className="bg-surface border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900">Informasi Bug</h3>

            <div className="space-y-2 text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Reporter</span>
                <span className="font-medium text-slate-800">
                  {bug.reporter.name || bug.reporter.email}
                </span>
              </div>

              {bug.coReporters.length > 0 && (
                <div className="py-1 border-b border-slate-100 text-xs">
                  <span className="text-slate-400 block mb-0.5">Dilaporkan juga</span>
                  <span className="text-slate-800 font-medium">
                    {bug.coReporters.map((cr) => cr.user.name || cr.user.email).join(", ")}
                    <span className="text-slate-500 font-normal"> · lewat duplikat</span>
                  </span>
                </div>
              )}

              {bug.duplicateOf && (
                <div className="py-1 border-b border-slate-100 text-xs">
                  <span className="text-slate-400 block mb-0.5">Duplikat dari</span>
                  <Link
                    href={`/projects/${project.key}/bugs/${bug.duplicateOf.number}`}
                    className="font-mono font-bold text-link hover:underline"
                  >
                    {bug.duplicateOf.key}
                  </Link>
                  <span className="text-slate-600 truncate block mt-0.5">{bug.duplicateOf.title}</span>
                </div>
              )}

              {bug.duplicates.length > 0 && (
                <div className="py-1 border-b border-slate-100 text-xs">
                  <span className="text-slate-400 block mb-0.5">Duplikat digabung ({bug.duplicates.length})</span>
                  <div className="space-y-0.5">
                    {bug.duplicates.map((d) => (
                      <div key={d.key} className="truncate">
                        <Link
                          href={`/projects/${project.key}/bugs/${d.number}`}
                          className="font-mono font-bold text-link hover:underline mr-1"
                        >
                          {d.key}
                        </Link>
                        <span className="text-slate-600">{d.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Environment</span>
                <span className="font-medium text-slate-800">{bug.environment || "Belum diisi"}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Modul</span>
                <span className="font-medium text-slate-800">{bug.module?.name ?? "Belum diisi"}</span>
              </div>

              {(bug.appVersion || bug.buildNumber) && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Ditemukan di</span>
                  <span className="font-medium text-slate-800">{buildLabel(bug.appVersion, bug.buildNumber)}</span>
                </div>
              )}
              {fixedIn && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Diperbaiki di</span>
                  <span className="font-medium text-slate-800">{fixedIn}</span>
                </div>
              )}
              {bug.verifiedAt && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Diverifikasi di</span>
                  <span className="font-medium text-slate-800">{bug.verifiedInBuild || "-"}</span>
                </div>
              )}
              {due && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Tenggat</span>
                  <span className={`font-medium ${due.overdue ? "text-sev-blocker font-bold" : "text-slate-800"}`}>{due.text}</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Priority</span>
                <span className="font-medium text-slate-800">{bug.priority}</span>
              </div>

              {bug.reopenCount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Reopen Count</span>
                  <span className="font-bold text-bad">{bug.reopenCount}x</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Dibuat</span>
                <span className="text-slate-700">{bug.createdAt.toLocaleString()}</span>
              </div>
            </div>

            {canEditFields && (
              <ActionForm action={handleFields} className="pt-2 space-y-2">
                <p className="text-slate-400 text-xs font-semibold">Perbaikan &amp; tenggat</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs text-slate-600">Versi perbaikan
                    <input name="fixedInVersion" defaultValue={bug.fixedInVersion ?? ""} placeholder="1.8.0" className="mt-0.5 w-full px-2 py-1 border border-slate-300 rounded bg-surface" />
                  </label>
                  <label className="block text-xs text-slate-600">Build
                    <input name="fixedInBuild" defaultValue={bug.fixedInBuild ?? ""} placeholder="b214" className="mt-0.5 w-full px-2 py-1 border border-slate-300 rounded bg-surface" />
                  </label>
                </div>
                <label className="block text-xs text-slate-600">Tenggat
                  <input type="date" name="dueAt" defaultValue={bug.dueAt ? bug.dueAt.toISOString().slice(0, 10) : ""} className="mt-0.5 w-full px-2 py-1 border border-slate-300 rounded bg-surface" />
                </label>
                <SubmitButton pendingText="Menyimpan..." className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-xs">Simpan</SubmitButton>
              </ActionForm>
            )}

            {/* Assignee form */}
            <form
              action={async (formData) => {
                "use server";
                const actor = await requireProjectPermission(project.id, "bug.update");
                const assigneeId = (formData.get("assigneeId") as string) || null;
                if (assigneeId && !(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: project.id, userId: assigneeId } } }))) return;

                await prisma.bug.update({
                  where: { id: bug.id },
                  data: { assigneeId },
                });

                await recordAuditLog({
                  projectId: project.id,
                  actorId: actor.id,
                  actorEmail: actor.email,
                  action: "bug.assign",
                  entityType: "bug",
                  entityId: bug.id,
                  changes: {
                    before: { assigneeId: bug.assigneeId },
                    after: { assigneeId },
                  },
                });
                if (assigneeId && assigneeId !== bug.assigneeId) await notifyBug(bug.id, actor, { kind: "assign" });

                revalidatePath(`/projects/${project.key}/bugs/${bug.number}`);
              }}
              className="pt-2"
            >
              <label className="block text-slate-400 text-xs mb-1 font-semibold">
                Assignee
              </label>
              <div className="flex gap-2">
                <select
                  name="assigneeId"
                  defaultValue={bug.assigneeId ?? ""}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded bg-surface text-xs"
                >
                  <option value="">-- Belum di-assign --</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name || m.user.email} ({m.role})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-xs"
                >
                  Ubah
                </button>
              </div>
            </form>
          </div>

          {/* Activity Timeline */}
          <div className="bg-surface border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900">Riwayat Aktivitas</h3>
            {timeline.length === 0 ? (
              <p className="text-slate-400 text-xs italic">Belum ada riwayat aktivitas.</p>
            ) : (
              <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                {timeline.map((item) => (
                  <li key={item.id} className="ml-3">
                    <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full border-2 border-white bg-slate-400" />
                    <p className="font-semibold text-slate-800 text-xs">
                      {item.action === "bug.create" && "Laporan dibuat"}
                      {item.action === "bug.status_change" && "Status diperbarui"}
                      {item.action === "bug.comment" && "Komentar ditambahkan"}
                      {item.action === "bug.assign" && "Assignee diubah"}
                      {!["bug.create", "bug.status_change", "bug.comment", "bug.assign"].includes(
                        item.action
                      ) && item.action}
                    </p>
                    <p className="text-xs text-slate-400">
                      Oleh {item.actorEmail || "Sistem"} • {item.createdAt.toLocaleTimeString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </main>
    </div>
  </AppShell>
  );
}

function LinkRow({ label, href }: { label: string; href: string }) {
  // href validated as http(s) on write (src/lib/bug-input.ts).
  return (
    <li className="flex gap-2">
      <span className="w-28 shrink-0 text-slate-500">{label}</span>
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-action hover:underline break-all">{href}</a>
    </li>
  );
}
