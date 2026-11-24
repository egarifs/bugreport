import { ActionForm, type ActionResult } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/user-service";
import { hashPassword, MIN_PASSWORD } from "@/lib/password";
import { ProjectRole, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/layout/app-shell";
import { isGuideRole, progressOf } from "@/lib/onboarding";
import { deleteSandbox, pruneStaleSandboxes } from "@/lib/sandbox-service";

const TABS = [
  { key: "pending", label: "Menunggu", status: UserStatus.PENDING },
  { key: "active", label: "Aktif", status: UserStatus.ACTIVE },
  { key: "rejected", label: "Ditolak", status: UserStatus.REJECTED },
  { key: "suspended", label: "Ditangguhkan", status: UserStatus.SUSPENDED },
] as const;

// Set INTERNAL_EMAIL_DOMAIN (e.g. "example.com") to mark staff accounts; empty = every account is external.
const internalDomain = (process.env.INTERNAL_EMAIL_DOMAIN ?? "").trim().toLowerCase().replace(/^@/, "");
const isInternal = (email: string) => !!internalDomain && email.toLowerCase().endsWith(`@${internalDomain}`);

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; isAdmin?: boolean }
    | undefined;

  if (!user?.isAdmin) {
    redirect("/projects");
  }

  // ponytail: bersihkan Latihan basi saat Admin membuka halaman ini (tanpa cron). Pindah ke cron bila perlu.
  void pruneStaleSandboxes().catch(() => {});
  const [pendingUsers, activeUsers, counts] = await Promise.all([
    prisma.user.findMany({
      omit: { passwordHash: true },
      where: { status: UserStatus.PENDING },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      omit: { passwordHash: true },
      where: { status: tab.status },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        memberships: {
          where: { project: { isSandbox: false } },
          include: { project: true },
        },
        onboarding: true,
      },
    }),
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  // Hash tidak pernah dimuat; hanya penanda ada/tidaknya.
  const hasPw = new Set((await prisma.user.findMany({ where: { id: { in: activeUsers.map((u) => u.id) }, passwordHash: { not: null } }, select: { id: true } })).map((u) => u.id));
  const countOf = (st: UserStatus) => counts.find((c) => c.status === st)?._count._all ?? 0;

  const projects = await prisma.project.findMany({
    where: { isArchived: false, isSandbox: false },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <div className="min-h-full flex flex-col">
        <header className="px-6 py-4 border-b border-slate-200">
          <div className="text-xs text-slate-500">Admin situs</div>
          <h1 className="text-xl font-bold text-slate-900">Persetujuan user</h1>
          <p className="text-sm text-slate-500">
            Setujui pendaftar dan beri project awal beserta perannya. Semua keputusan dicatat di audit log.
          </p>
        </header>
        <nav aria-label="Status user" className="px-6 flex gap-5 border-b border-slate-200">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={`/admin/users?tab=${t.key}`}
              aria-current={t.key === tab.key ? "page" : undefined}
              className={`min-h-[44px] flex items-center gap-1.5 text-sm font-bold border-b-2 ${
                t.key === tab.key ? "border-action text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
              <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-1.5">{countOf(t.status)}</span>
            </a>
          ))}
        </nav>

        <main className="p-6 space-y-8 flex-1">
        {tab.key === "pending" && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900">
              Menunggu persetujuan
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warn-bg text-warn">
              {pendingUsers.length}
            </span>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="bg-surface border border-slate-200 rounded p-6 text-center text-xs text-slate-500">
              Tidak ada pendaftar baru yang menunggu persetujuan.
            </div>
          ) : (
            <div className="bg-surface border border-slate-200 rounded divide-y divide-slate-100">
              {pendingUsers.map((p) => (
                <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm text-slate-900">
                      {p.name || "(Tanpa nama)"}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      {p.email}
                      <span className={`px-1.5 rounded text-xs font-bold ${isInternal(p.email) ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>
                        {isInternal(p.email) ? "Internal" : "Eksternal"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Mendaftar: {p.createdAt.toLocaleString()}
                    </div>
                  </div>

                  <ActionForm
                    action={async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
                      "use server";
                      const reviewer = await requireAdmin();
                      const action = formData.get("action") as string;
                      const projectId = formData.get("projectId") as string;
                      const role = formData.get("role") as string;
                      if (action !== "approve" && action !== "reject") return { error: "Aksi tidak dikenal." };
                      const reason = ((formData.get("reason") as string) ?? "").trim().slice(0, 500);
                      if (action === "reject" && !reason) return { error: "Isi alasan penolakan dulu." };
                      if (action === "approve" && !projectId) return { error: "Pilih project awal sebelum menyetujui." };
                      if (action === "approve" && !(Object.values(ProjectRole) as string[]).includes(role)) return { error: "Role tidak valid." };
                      if (projectId && !(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) return { error: "Project tidak ditemukan." };

                      if (action === "approve") {
                        await prisma.user.update({
                          where: { id: p.id },
                          data: {
                            status: UserStatus.ACTIVE,
                            reviewedById: reviewer?.id,
                            reviewedAt: new Date(),
                          },
                        });

                        if (projectId && role) {
                          const projectRole = role as ProjectRole;
                          await prisma.projectMember.upsert({
                            where: {
                              projectId_userId: { projectId, userId: p.id },
                            },
                            update: { role: projectRole },
                            create: {
                              projectId,
                              userId: p.id,
                              role: projectRole,
                            },
                          });
                        }

                        await recordAuditLog({
                          actorId: reviewer?.id,
                          actorEmail: reviewer?.email || "unknown",
                          action: "user.approve",
                          entityType: "user",
                          entityId: p.id,
                          changes: {
                            before: { status: p.status },
                            after: { status: UserStatus.ACTIVE, projectId, role },
                          },
                        });
                      } else if (action === "reject") {
                        await prisma.user.update({
                          where: { id: p.id },
                          data: {
                            status: UserStatus.REJECTED,
                            rejectReason: reason,
                            reviewedById: reviewer?.id,
                            reviewedAt: new Date(),
                          },
                        });
                        await recordAuditLog({
                          actorId: reviewer?.id,
                          actorEmail: reviewer?.email || "unknown",
                          action: "user.reject",
                          entityType: "user",
                          entityId: p.id,
                          changes: { after: { reason } },
                        });
                        await deleteSandbox(p.id); // Latihan pengguna yang ditolak tidak perlu disimpan
                      }
                      revalidatePath("/admin/users");
                      return { ok: action === "approve" ? `${p.email} disetujui.` : `${p.email} ditolak.` };
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <select
                      name="projectId"
                      className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-surface"
                      defaultValue=""
                    >
                      <option value="">-- Pilih Project Awal --</option>
                      {projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.key} - {pr.name}
                        </option>
                      ))}
                    </select>

                    <select
                      name="role"
                      className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-surface"
                      defaultValue="QA"
                    >
                      <option value="QA">QA</option>
                      <option value="DEVELOPER">Developer</option>
                      <option value="VENDOR">Vendor</option>
                      <option value="CLIENT">Client</option>
                      <option value="VIEWER">Viewer</option>
                      <option value="ADMIN">Admin Project</option>
                    </select>

                    <input
                      type="text"
                      name="reason"
                      aria-label={`Alasan jika menolak ${p.email}`}
                      placeholder="Alasan (wajib jika Tolak)"
                      className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-surface w-48"
                    />
                    <button
                      type="submit"
                      name="action"
                      value="approve"
                      className="text-xs px-3 py-1.5 bg-action hover:bg-action-hover text-on-action font-bold rounded"
                    >
                      Setujui
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="reject"
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-sev-blocker-bg hover:text-sev-blocker text-slate-700 font-medium rounded"
                    >
                      Tolak
                    </button>
                  </ActionForm>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 bg-slate-100 border border-slate-200 rounded p-3 text-xs text-slate-600">
            <b>Peran untuk email eksternal.</b> Domain di luar domain internal disarankan Vendor atau Client. Admin, QA, atau Developer bisa membaca catatan internal.
          </div>
        </section>

        )}

        {tab.key !== "pending" && (
        <section>
          <h2 className="text-base font-bold text-slate-900 mb-3">
            Pengguna
          </h2>
          <div className="bg-surface border border-slate-200 rounded divide-y divide-slate-100">
            {activeUsers.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    <span>{u.name || u.email}</span>
                    {u.isAdmin && (
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-xs">
                        Global Admin
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.2 rounded text-xs ${
                        u.status === "ACTIVE"
                          ? "bg-ok-bg text-ok"
                          : u.status === "SUSPENDED"
                          ? "bg-warn-bg text-warn"
                          : "bg-bad-bg text-bad"
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-0.5">{u.email}</div>
                  <div className="text-slate-400 mt-1">
                    Projects:{" "}
                    {u.memberships.length === 0
                      ? "(belum ada)"
                      : u.memberships
                          .map((m) => `${m.project.key} (${m.role})`)
                          .join(", ")}
                  </div>
                  {u.status === "ACTIVE" && (() => {
                    const p = progressOf(isGuideRole(u.onboarding?.guideRole) ? u.onboarding!.guideRole as never : null, u.onboarding?.completedSteps ?? []);
                    return (
                      <div className="mt-1 flex items-center gap-2 text-slate-600">
                        <span>Onboarding {p.done}/{p.total}</span>
                        <span className="w-20 h-1.5 rounded bg-slate-100" aria-hidden="true"><span className="block h-full rounded bg-ink" style={{ width: `${(p.done / p.total) * 100}%` }} /></span>
                        {p.done < p.total && (
                          <form action={async () => {
                            "use server";
                            const admin = await requireAdmin();
                            await prisma.notification.create({ data: { userId: u.id, type: "onboarding", title: "Selesaikan panduan BugBoard", body: "Coba langkah pertama di Project Latihan.", href: "/onboarding", actorName: admin.email } });
                            await recordAuditLog({ actorId: admin.id, actorEmail: admin.email, action: "onboarding.remind", entityType: "user", entityId: u.id, changes: { after: { email: u.email } } });
                            revalidatePath("/admin/users");
                          }}><button className="underline font-bold min-h-[32px]">Kirim pengingat</button></form>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {u.status === "ACTIVE" && (
                  <ActionForm
                    action={async (_prev: ActionResult, fd: FormData): Promise<ActionResult> => {
                      "use server";
                      const admin = await requireAdmin();
                      const pw = String(fd.get("password") ?? "");
                      if (pw.length < MIN_PASSWORD) return { error: `Kata sandi minimal ${MIN_PASSWORD} karakter.` };
                      await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null } });
                      await recordAuditLog({ actorId: admin.id, actorEmail: admin.email, action: "user.set_password", entityType: "user", entityId: u.id, changes: { after: { email: u.email } } });
                      return { ok: `Kata sandi ${u.email} ${hasPw.has(u.id) ? "diganti" : "diatur"}.` };
                    }}
                    className="flex gap-1 items-start"
                  >
                    <input type="password" name="password" required minLength={MIN_PASSWORD} autoComplete="new-password" placeholder={hasPw.has(u.id) ? "Ganti kata sandi" : "Atur kata sandi"} aria-label={`Kata sandi baru untuk ${u.email}`} className="px-2 py-1 text-xs border border-slate-300 rounded" />
                    <button type="submit" className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">Simpan</button>
                  </ActionForm>
                )}
                {!u.isAdmin && (
                  <form
                    action={async () => {
                      "use server";
                      await requireAdmin();
                      const current = u.status;
                      const next = current === "ACTIVE" ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
                      await prisma.user.update({
                        where: { id: u.id },
                        data: { status: next },
                      });
                      revalidatePath("/admin/users");
                    }}
                  >
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                    >
                      {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
        )}
      </main>
    </div>
  </AppShell>
  );
}
