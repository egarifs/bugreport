import { requireAdmin } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/user-service";
import { ProjectRole, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/layout/app-shell";

export default async function AdminUsersPage() {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; isAdmin?: boolean }
    | undefined;

  if (!user?.isAdmin) {
    redirect("/projects");
  }

  const [pendingUsers, activeUsers] = await Promise.all([
    prisma.user.findMany({
      where: { status: UserStatus.PENDING },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { status: { in: [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.REJECTED] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        memberships: {
          include: { project: true },
        },
      },
    }),
  ]);

  const projects = await prisma.project.findMany({
    where: { isArchived: false },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900 text-sm">
              Admin: User Approval & Management
            </span>
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded">
              Super Admin Area
            </span>
          </div>
        </header>

        <main className="max-w-6xl w-full mx-auto p-6 space-y-8 flex-1">
        {/* Pending Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900">
              Antrean Persetujuan (Pending)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              {pendingUsers.length}
            </span>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded p-6 text-center text-xs text-slate-500">
              Tidak ada pendaftar baru yang menunggu persetujuan.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded divide-y divide-slate-100">
              {pendingUsers.map((p) => (
                <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm text-slate-900">
                      {p.name || "(Tanpa nama)"}
                    </div>
                    <div className="text-xs text-slate-500">{p.email}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Mendaftar: {p.createdAt.toLocaleString()}
                    </div>
                  </div>

                  <form
                    action={async (formData) => {
                      "use server";
                      const reviewer = await requireAdmin();
                      const action = formData.get("action") as string;
                      const projectId = formData.get("projectId") as string;
                      const role = formData.get("role") as string;

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
                        });
                      }
                      revalidatePath("/admin/users");
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <select
                      name="projectId"
                      className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white"
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
                      className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white"
                      defaultValue="QA"
                    >
                      <option value="QA">QA</option>
                      <option value="DEVELOPER">Developer</option>
                      <option value="VENDOR">Vendor</option>
                      <option value="CLIENT">Client</option>
                      <option value="VIEWER">Viewer</option>
                      <option value="ADMIN">Admin Project</option>
                    </select>

                    <button
                      type="submit"
                      name="action"
                      value="approve"
                      className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded"
                    >
                      Setujui
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="reject"
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-medium rounded"
                    >
                      Tolak
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Existing Users */}
        <section>
          <h2 className="text-base font-bold text-slate-900 mb-3">
            Pengguna Terdaftar
          </h2>
          <div className="bg-white border border-slate-200 rounded divide-y divide-slate-100">
            {activeUsers.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    <span>{u.name || u.email}</span>
                    {u.isAdmin && (
                      <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded text-xs">
                        Global Admin
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.2 rounded text-xs ${
                        u.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : u.status === "SUSPENDED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
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
                </div>

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
      </main>
    </div>
  </AppShell>
  );
}
