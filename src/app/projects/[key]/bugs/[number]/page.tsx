import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canTransitionBug, hasPermission } from "@/lib/permissions";
import { redactSecrets } from "@/lib/redact";
import { recordAuditLog } from "@/lib/user-service";
import { BugStatus, CommentType, ProjectRole } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/layout/app-shell";

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
      comments: {
        where: canSeeInternalNotes ? {} : { type: CommentType.PUBLIC },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  if (!bug) notFound();

  // Audit timeline for activity
  const timeline = await prisma.auditLog.findMany({
    where: { entityType: "bug", entityId: bug.id },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

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

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${project.key}`}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← {project.key}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {bug.key}
            </span>
            <span className="font-semibold text-slate-900 text-sm truncate max-w-md">
              {bug.title}
            </span>
          </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              bug.severity === "BLOCKER"
                ? "bg-red-100 text-red-700"
                : bug.severity === "HIGH"
                ? "bg-orange-100 text-orange-700"
                : bug.severity === "MEDIUM"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {bug.severity}
          </span>

          <span
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              bug.status === "DRAFT"
                ? "bg-purple-100 text-purple-700"
                : bug.status === "OPEN"
                ? "bg-blue-100 text-blue-700"
                : bug.status === "IN_PROGRESS"
                ? "bg-amber-100 text-amber-700"
                : bug.status === "READY_FOR_VERIFICATION"
                ? "bg-teal-100 text-teal-700"
                : bug.status === "CLOSED"
                ? "bg-emerald-100 text-emerald-700"
                : bug.status === "REOPENED"
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {bug.status}
          </span>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto p-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Detail content & comments */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900 mb-4">{bug.title}</h1>

            <div className="space-y-4 text-xs">
              <div>
                <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Langkah Reproduksi
                </h3>
                <pre className="bg-slate-50 border border-slate-200 rounded p-3 font-mono whitespace-pre-wrap text-slate-800">
                  {bug.stepsToReproduce}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Hasil yang Diharapkan
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800">
                    {bug.expectedResult}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Hasil Aktual
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800">
                    {bug.actualResult}
                  </div>
                </div>
              </div>

              {bug.duplicateOf && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-900">
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

              {bug.description && bug.description !== bug.title && (
                <div>
                  <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Deskripsi / Catatan Tambahan
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800 whitespace-pre-wrap">
                    {bug.description}
                  </div>
                </div>
              )}

              {bug.reopenReason && (
                <div className="bg-rose-50 border border-rose-200 rounded p-3 text-rose-900">
                  <span className="font-semibold">Alasan Reopen:</span> {bug.reopenReason}
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
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
                        ? "bg-amber-50/50 border-amber-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-800">
                        {c.author.name || c.author.email}
                      </span>
                      <div className="flex items-center gap-2">
                        {c.type === CommentType.INTERNAL && (
                          <span className="text-[10px] font-semibold bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded">
                            Catatan Internal
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
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
                const actor = (await auth())?.user as { id: string; email: string };
                const body = redactSecrets((formData.get("body") as string).trim());
                const type = (formData.get("type") as CommentType) || CommentType.PUBLIC;

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
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium"
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
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900">Ubah Status</h3>

            {possibleStatuses.length === 0 ? (
              <p className="text-slate-400 text-xs italic">
                Tidak ada transisi status yang dapat dilakukan oleh role Anda saat ini.
              </p>
            ) : (
              <form
                action={async (formData) => {
                  "use server";
                  const actor = (await auth())?.user as { id: string; email: string };
                  const targetStatus = formData.get("targetStatus") as BugStatus;
                  const reopenReason = (formData.get("reopenReason") as string)?.trim();
                  const appVersion = (formData.get("appVersion") as string)?.trim();
                  const duplicateOfKey = (formData.get("duplicateOfKey") as string)?.trim();

                  const check = canTransitionBug(bug.status, targetStatus, userRole, user.isAdmin);
                  if (!check.allowed) return;

                  // AC: Reopen without reason rejected
                  if (targetStatus === BugStatus.REOPENED && !reopenReason) {
                    return;
                  }

                  // AC: Draft -> Open requires version/build
                  if (targetStatus === BugStatus.OPEN && bug.status === BugStatus.DRAFT) {
                    const finalVersion = appVersion || bug.appVersion;
                    if (!finalVersion) {
                      return;
                    }
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
                      ...(duplicateOfId ? { duplicateOfId } : {}),
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

                  revalidatePath(`/projects/${project.key}/bugs/${bug.number}`);
                }}
                className="space-y-2"
              >
                <select
                  name="targetStatus"
                  required
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                >
                  {possibleStatuses.map((s) => (
                    <option key={s} value={s}>
                      → {s}
                    </option>
                  ))}
                </select>

                {bug.status === BugStatus.DRAFT && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">
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
                  <label className="block text-[11px] text-slate-500 mb-0.5">
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
                  <label className="block text-[11px] text-slate-500 mb-0.5">
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

                <button
                  type="submit"
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded text-xs"
                >
                  Terapkan Status
                </button>
              </form>
            )}
          </div>

          {/* Assignment & Details */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900">Informasi Bug</h3>

            <div className="space-y-2 text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Reporter</span>
                <span className="font-medium text-slate-800">
                  {bug.reporter.name || bug.reporter.email}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Environment</span>
                <span className="font-medium text-slate-800">{bug.environment}</span>
              </div>

              {bug.component && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Area</span>
                  <span className="font-medium text-slate-800">{bug.component}</span>
                </div>
              )}

              {bug.appVersion && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Versi / Build</span>
                  <span className="font-medium text-slate-800">{bug.appVersion}</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Priority</span>
                <span className="font-medium text-slate-800">{bug.priority}</span>
              </div>

              {bug.reopenCount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Reopen Count</span>
                  <span className="font-bold text-rose-700">{bug.reopenCount}x</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Dibuat</span>
                <span className="text-slate-700">{bug.createdAt.toLocaleString()}</span>
              </div>
            </div>

            {/* Assignee form */}
            <form
              action={async (formData) => {
                "use server";
                const actor = (await auth())?.user as { id: string; email: string };
                const assigneeId = (formData.get("assigneeId") as string) || null;

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

                revalidatePath(`/projects/${project.key}/bugs/${bug.number}`);
              }}
              className="pt-2"
            >
              <label className="block text-slate-400 text-[11px] mb-1 font-semibold">
                Assignee
              </label>
              <div className="flex gap-2">
                <select
                  name="assigneeId"
                  defaultValue={bug.assigneeId ?? ""}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded bg-white text-xs"
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
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900">Riwayat Aktivitas</h3>
            {timeline.length === 0 ? (
              <p className="text-slate-400 text-xs italic">Belum ada riwayat aktivitas.</p>
            ) : (
              <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                {timeline.map((item) => (
                  <li key={item.id} className="ml-3">
                    <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full border-2 border-white bg-slate-400" />
                    <p className="font-semibold text-slate-800 text-[11px]">
                      {item.action === "bug.create" && "Laporan dibuat"}
                      {item.action === "bug.status_change" && "Status diperbarui"}
                      {item.action === "bug.comment" && "Komentar ditambahkan"}
                      {item.action === "bug.assign" && "Assignee diubah"}
                      {!["bug.create", "bug.status_change", "bug.comment", "bug.assign"].includes(
                        item.action
                      ) && item.action}
                    </p>
                    <p className="text-[10px] text-slate-400">
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
