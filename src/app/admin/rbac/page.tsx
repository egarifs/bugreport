import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectRole, UserStatus } from "@prisma/client";
import { type Permission, loadRolePermissions, invalidateRolePermissionCache } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import Link from "next/link";

const ALL_PERMISSIONS: { key: Permission; label: string; desc: string }[] = [
  { key: "project.read", label: "Lihat Project", desc: "Membaca ringkasan & daftar project" },
  { key: "project.manage", label: "Kelola Project", desc: "Ubah pengaturan, anggota, modul project" },
  { key: "bug.create", label: "Buat Bug", desc: "Laporkan temuan bug baru" },
  { key: "bug.review", label: "Tinjau Bug", desc: "Setujui bug draft menjadi open, set priority" },
  { key: "bug.update", label: "Perbarui Bug", desc: "Kerjakan bug (open -> in progress -> ready for verification)" },
  { key: "bug.close", label: "Tutup Bug", desc: "Verifikasi hasil dan tutup bug" },
  { key: "bug.reopen", label: "Buka Ulang Bug", desc: "Buka kembali bug yang sudah closed" },
  { key: "bug.comment", label: "Komentari Bug", desc: "Kirim komentar umum pada bug" },
  { key: "note.internal.read", label: "Catatan Internal", desc: "Lihat dan tulis catatan internal" },
  { key: "doc.read", label: "Baca Dokumen", desc: "Akses dokumen PRD & spesifikasi bisnis" },
  { key: "doc.manage", label: "Kelola Dokumen", desc: "Unggah revisi dokumen baru" },
  { key: "doc.approve", label: "Setujui Dokumen", desc: "Setujui revisi dokumen bisnis" },
  { key: "testcase.read", label: "Baca Test Case", desc: "Akses daftar skenario pengujian" },
  { key: "testcase.manage", label: "Kelola Test Case", desc: "Buat, edit, hapus skenario pengujian" },
  { key: "testrun.execute", label: "Jalankan Test Run", desc: "Eksekusi siklus uji & catat pass/fail" },
  { key: "chat.ask", label: "AI Project Chat", desc: "Bertanya ke asisten AI konteks project" },
  { key: "user.review", label: "Review User", desc: "Setujui user pendaftar baru" },
];

const ROLES: ProjectRole[] = ["QA", "DEVELOPER", "VENDOR", "CLIENT", "VIEWER", "ADMIN"];

export default async function AdminRbacPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; role?: string }>;
}) {
  await requireAdmin();
  const { tab = "users", q = "", role: selectedRole = "" } = await searchParams;

  // Data for Sub-menu 1: Users
  const searchFilter = q.trim();
  const roleFilter = selectedRole.trim() as ProjectRole | "";

  const users = await prisma.user.findMany({
    where: {
      AND: [
        searchFilter
          ? {
              OR: [
                { name: { contains: searchFilter, mode: "insensitive" } },
                { email: { contains: searchFilter, mode: "insensitive" } },
              ],
            }
          : {},
        roleFilter
          ? {
              memberships: {
                some: { role: roleFilter },
              },
            }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        include: { project: true },
      },
    },
    take: 100,
  });

  // Data for Sub-menu 2: Role Permissions
  const rolePermissions = await loadRolePermissions();

  return (
    <AppShell>
      <div className="min-h-full flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-200 bg-surface">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Administrator</div>
          <h1 className="text-xl font-bold text-slate-900">Kelola Akses & RBAC</h1>
          <p className="text-sm text-slate-500">
            Kelola izin hak akses per peran (Role-Based Access Control) dan periksa penugasan peran pengguna.
          </p>
        </header>

        {/* Sub-menu Tabs */}
        <nav aria-label="Sub menu RBAC" className="px-6 flex gap-6 border-b border-slate-200 bg-surface">
          <Link
            href="/admin/rbac?tab=users"
            aria-current={tab === "users" ? "page" : undefined}
            className={`min-h-[44px] flex items-center gap-2 text-sm font-bold border-b-2 transition-colors ${
              tab === "users"
                ? "border-action text-action"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Daftar Pengguna ({users.length})
          </Link>
          <Link
            href="/admin/rbac?tab=roles"
            aria-current={tab === "roles" ? "page" : undefined}
            className={`min-h-[44px] flex items-center gap-2 text-sm font-bold border-b-2 transition-colors ${
              tab === "roles"
                ? "border-action text-action"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Izin & Hak Akses Peran
          </Link>
          <Link
            href="/admin/users"
            className="min-h-[44px] flex items-center gap-1.5 text-sm font-medium border-b-2 border-transparent text-slate-400 hover:text-slate-700 ml-auto"
          >
            Antrean Approval &rarr;
          </Link>
        </nav>

        {/* Content */}
        <main className="p-6 flex-1 space-y-6">
          {tab === "users" ? (
            <div className="space-y-4">
              {/* Filter Bar */}
              <form method="get" className="bg-surface p-4 border border-slate-200 rounded-xl flex flex-wrap gap-3 items-center">
                <input type="hidden" name="tab" value="users" />
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="search-user" className="sr-only">Cari Pengguna</label>
                  <input
                    id="search-user"
                    type="text"
                    name="q"
                    defaultValue={q}
                    placeholder="Cari nama atau email..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div className="w-48">
                  <label htmlFor="filter-role" className="sr-only">Filter Role</label>
                  <select
                    id="filter-role"
                    name="role"
                    defaultValue={selectedRole}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">-- Semua Role --</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800"
                >
                  Filter
                </button>
                {(q || selectedRole) && (
                  <Link
                    href="/admin/rbac?tab=users"
                    className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
                  >
                    Reset
                  </Link>
                )}
              </form>

              {/* Users Table */}
              <div className="bg-surface border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Pengguna</th>
                      <th className="px-4 py-3">Status Akun</th>
                      <th className="px-4 py-3">Tipe Global</th>
                      <th className="px-4 py-3">Peran di Project</th>
                      <th className="px-4 py-3">Bergabung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          Tidak ditemukan pengguna dengan filter tersebut.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{u.name || "(Tanpa Nama)"}</div>
                              <div className="text-slate-500 font-mono text-[11px]">{u.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  u.status === UserStatus.ACTIVE
                                    ? "bg-ok-bg text-ok"
                                    : u.status === UserStatus.PENDING
                                    ? "bg-warn-bg text-warn"
                                    : "bg-bad-bg text-bad"
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {u.isAdmin ? (
                                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                                  Superadmin
                                </span>
                              ) : (
                                <span className="text-slate-500">Standard User</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {u.memberships.length === 0 ? (
                                <span className="text-slate-400 italic">Belum ada project</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {u.memberships.map((m) => (
                                    <span
                                      key={m.id}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]"
                                    >
                                      <b>{m.project.key}:</b>
                                      <span className="font-semibold text-action">{m.role}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {new Date(u.createdAt).toLocaleDateString("id-ID")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 flex items-start gap-2">
                <svg className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Centang izin untuk mengizinkan tindakan pada peran terkait. Perubahan langsung tersimpan ke database dan aktif secara real-time. Role <b>ADMIN</b> memegang semua kewenangan penuh.
                </span>
              </div>

              {/* Role Permissions Matrix */}
              <div className="bg-surface border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-4 py-3 min-w-[240px]">Izin Tindakan (Permission)</th>
                      {ROLES.map((r) => (
                        <th key={r} className="px-4 py-3 text-center min-w-[100px]">
                          <span className={`px-2 py-0.5 rounded font-bold text-xs ${r === "ADMIN" ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-800"}`}>
                            {r}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ALL_PERMISSIONS.map((perm) => (
                      <tr key={perm.key} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{perm.label}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{perm.key}</div>
                          <div className="text-[11px] text-slate-400">{perm.desc}</div>
                        </td>
                        {ROLES.map((role) => {
                          const isChecked = rolePermissions[role]?.includes(perm.key) ?? false;
                          const isAdminRole = role === "ADMIN";

                          return (
                            <td key={role} className="px-4 py-3 text-center">
                              {isAdminRole ? (
                                <input
                                  type="checkbox"
                                  checked={true}
                                  disabled
                                  className="w-4 h-4 text-indigo-600 rounded cursor-not-allowed opacity-60"
                                  title="Admin selalu memegang izin penuh"
                                />
                              ) : (
                                <form
                                  action={async () => {
                                    "use server";
                                    await requireAdmin();
                                    const nextState = !isChecked;
                                    await prisma.rolePermission.upsert({
                                      where: {
                                        role_permission: {
                                          role,
                                          permission: perm.key,
                                        },
                                      },
                                      update: { enabled: nextState },
                                      create: {
                                        role,
                                        permission: perm.key,
                                        enabled: nextState,
                                      },
                                    });
                                    invalidateRolePermissionCache();
                                    revalidatePath("/admin/rbac");
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors mx-auto cursor-pointer ${
                                      isChecked
                                        ? "bg-action border-action text-white"
                                        : "bg-surface border-slate-300 hover:border-slate-400"
                                    }`}
                                    title={`Klik untuk ${isChecked ? "mencabut" : "memberikan"} izin ${perm.key} ke role ${role}`}
                                  >
                                    {isChecked && (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                </form>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
