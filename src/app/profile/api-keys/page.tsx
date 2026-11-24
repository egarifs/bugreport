import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { SubmitButton } from "@/components/ui/action-form";
import { generateApiKey, AGENT_QA_SCOPES } from "@/lib/mcp-auth";
import { ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ProfileApiKeysPage(props: {
  searchParams: Promise<{ newKey?: string; project?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null; email?: string | null; isAdmin?: boolean; status?: string } | undefined;

  if (!user || user.status !== "ACTIVE" || !user.id) {
    redirect("/login");
  }

  const sp = await props.searchParams;
  const newCreatedKey = sp.newKey;

  // 1. Fetch project options accessible to this user
  const userMemberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: { select: { id: true, key: true, name: true, isArchived: true, isSandbox: true } },
    },
  });

  let availableProjects: { id: string; key: string; name: string; role: ProjectRole }[] = [];

  if (user.isAdmin) {
    const allProjects = await prisma.project.findMany({
      where: { isArchived: false, isSandbox: false },
      select: { id: true, key: true, name: true },
      orderBy: { name: "asc" },
    });
    availableProjects = allProjects.map((p) => {
      const mem = userMemberships.find((m) => m.projectId === p.id);
      return {
        id: p.id,
        key: p.key,
        name: p.name,
        role: mem ? mem.role : ("ADMIN" as ProjectRole),
      };
    });
  } else {
    availableProjects = userMemberships
      .filter((m) => !m.project.isArchived && !m.project.isSandbox)
      .map((m) => ({
        id: m.project.id,
        key: m.project.key,
        name: m.project.name,
        role: m.role,
      }));
  }

  // 2. Query API Keys: Super Admin sees all keys across all users; regular users see only their own keys
  const apiKeys = await prisma.apiKey.findMany({
    where: user.isAdmin ? {} : { createdById: user.id },
    include: {
      project: { select: { id: true, key: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/60 pb-12">
        <header className="bg-surface border-b border-slate-200/80 px-4 md:px-8 py-3.5 flex items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-xs">
          <div>
            <h1 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-2">
              <span>MCP AI Agent Secret Keys</span>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                {user.isAdmin ? "Mode Super Admin (Semua Kunci)" : "Kunci Saya"}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Secret key untuk integrasi Claude Code, Cursor, Pi CLI, atau Playwright via MCP Server.
            </p>
          </div>
          <Link
            href="/api-docs"
            className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-md bg-surface font-medium transition-colors"
          >
            Dokumentasi MCP
          </Link>
        </header>

        <main className="p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
          {newCreatedKey && (
            <div role="alert" className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Simpan Secret Key Anda sekarang! Kunci ini hanya ditampilkan sekali.</span>
              </div>
              <div className="font-mono bg-surface border border-amber-300 p-2.5 rounded select-all text-amber-900 font-bold break-all text-xs">
                {newCreatedKey}
              </div>
              <p className="text-[11px] text-amber-800">
                Gunakan header <code>Authorization: Bearer {newCreatedKey.slice(0, 16)}...</code> pada endpoint <code>/api/mcp</code>.
              </p>
            </div>
          )}

          {/* Create Secret Key Card */}
          <section className="bg-surface border border-slate-200 rounded-lg p-5 shadow-2xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
              Buat Secret Key Baru
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Setiap secret key terikat pada <b>satu project tertentu</b>. Hak akses dan scope agent dibatasi oleh role Anda di project tersebut.
            </p>

            {availableProjects.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 bg-slate-50 border border-dashed rounded">
                Anda belum terdaftar di project manapun. Hubungi Admin untuk dimasukkan ke dalam project sebelum membuat API key.
              </p>
            ) : (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const s = await auth();
                  const curUser = s?.user as { id?: string; isAdmin?: boolean; status?: string } | undefined;
                  if (!curUser || curUser.status !== "ACTIVE" || !curUser.id) {
                    throw new Error("Sesi tidak valid");
                  }

                  const name = (formData.get("name") as string)?.trim();
                  if (!name) return;

                  const projectId = (formData.get("projectId") as string)?.trim();
                  if (!projectId) return;

                  // Verify user membership in project
                  const targetProject = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: { id: true, isArchived: true, isSandbox: true },
                  });
                  if (!targetProject || targetProject.isArchived || targetProject.isSandbox) {
                    throw new Error("Project tidak valid, diarsipkan, atau project Latihan");
                  }

                  let effectiveRole: ProjectRole = "VIEWER";
                  if (curUser.isAdmin) {
                    effectiveRole = "ADMIN";
                  } else {
                    const member = await prisma.projectMember.findUnique({
                      where: { projectId_userId: { projectId, userId: curUser.id } },
                      select: { role: true },
                    });
                    if (!member) {
                      throw new Error("Anda tidak memiliki akses ke project ini");
                    }
                    effectiveRole = member.role;
                  }

                  const expireDays = Number(formData.get("expireDays")) || 30;
                  let expiresAt: Date | null = null;
                  if (expireDays > 0) {
                    expiresAt = new Date(Date.now() + expireDays * 86400_000);
                  }

                  // Determine scopes bounded strictly by user's role in this project
                  const requestedPreset = formData.get("preset") as string;
                  const isAgentQa = requestedPreset === "AGENT_QA" && ["ADMIN", "QA"].includes(effectiveRole);

                  let finalRole: ProjectRole = "VIEWER";
                  let finalScopes: string[] = ["bug:read", "testcase:read", "doc:read"];

                  if (["ADMIN", "QA"].includes(effectiveRole)) {
                    finalRole = "QA";
                    finalScopes = isAgentQa
                      ? AGENT_QA_SCOPES
                      : ["bug:read", "bug:create", "bug:comment", "bug:attach", "testcase:create", "testcase:read", "doc:read", "doc:manage"];
                  } else if (effectiveRole === "DEVELOPER") {
                    finalRole = "DEVELOPER";
                    finalScopes = ["bug:read", "bug:comment", "testcase:read", "doc:read"];
                  } else if (effectiveRole === "VENDOR") {
                    finalRole = "VENDOR";
                    finalScopes = ["bug:read", "bug:comment", "testcase:read", "testrun:execute", "evidence:upload"];
                  }

                  const { rawKey, keyHash, keyPrefix } = generateApiKey();

                  await prisma.apiKey.create({
                    data: {
                      projectId,
                      name,
                      keyHash,
                      keyPrefix,
                      role: finalRole,
                      preset: isAgentQa ? "AGENT_QA" : "CUSTOM",
                      expiresAt,
                      scopes: finalScopes,
                      createdById: curUser.id,
                    },
                  });

                  revalidatePath("/profile/api-keys");
                  redirect(`/profile/api-keys?newKey=${rawKey}`);
                }}
                className="flex flex-wrap items-center gap-2.5 text-xs"
              >
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Nama agent (misal: Claude QA Local, Cursor Bot)"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded bg-surface text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
                  />
                </div>

                <div className="min-w-[190px]">
                  <select
                    name="projectId"
                    required
                    defaultValue={sp.project || availableProjects[0]?.id}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-surface text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                  >
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.key}] {p.name} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    name="preset"
                    className="px-2.5 py-1.5 border border-slate-300 rounded bg-surface text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                  >
                    <option value="CUSTOM">Preset: Sesuai Role Akun</option>
                    <option value="AGENT_QA">Preset: Agent QA (Khusus QA/Admin)</option>
                  </select>
                </div>

                <div>
                  <select
                    name="expireDays"
                    defaultValue="30"
                    className="px-2.5 py-1.5 border border-slate-300 rounded bg-surface text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                  >
                    <option value="7">7 Hari</option>
                    <option value="30">30 Hari</option>
                    <option value="90">90 Hari</option>
                    <option value="0">Tanpa Batas</option>
                  </select>
                </div>

                <SubmitButton pendingText="Membuat..." className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded transition-colors">
                  + Buat Secret Key
                </SubmitButton>
              </form>
            )}
          </section>

          {/* List of Secret Keys */}
          <section className="bg-surface border border-slate-200 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Daftar Secret Key Aktif ({apiKeys.length})
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {user.isAdmin ? "Audit mode: menampilkan semua pemilik" : "Hanya menampilkan kunci milik Anda"}
              </span>
            </div>

            {apiKeys.length === 0 ? (
              <div className="text-xs text-slate-400 py-10 text-center border border-dashed rounded mt-4">
                Belum ada secret key yang dibuat.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2">
                {apiKeys.map((k) => {
                  const isRevoked = Boolean(k.revokedAt);
                  const isExpired = !isRevoked && Boolean(k.expiresAt && k.expiresAt < new Date());
                  const isActive = !isRevoked && !isExpired;
                  const canRevoke = user.isAdmin || k.createdById === user.id;

                  return (
                    <div key={k.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{k.name}</span>
                          <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {k.keyPrefix}...
                          </span>
                          <span className="font-mono font-medium text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            Project: [{k.project.key}] {k.project.name}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.2 rounded ${
                            k.role === "QA" ? "bg-action-soft text-action" : "bg-slate-100 text-slate-700"
                          }`}>
                            Role: {k.role}
                          </span>
                          {isRevoked ? (
                            <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.2 rounded font-semibold">
                              Dicabut (Revoked)
                            </span>
                          ) : isExpired ? (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.2 rounded font-semibold">
                              Kedaluwarsa
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.2 rounded font-semibold">
                              Aktif
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-[11px] mt-1.5">
                          <span>
                            Dibuat oleh: <b className="text-slate-700 font-medium">{k.createdBy.name || k.createdBy.email}</b>
                            {k.createdById === user.id && <span className="text-action ml-1">(Anda)</span>}
                          </span>
                          <span>
                            Kadaluwarsa: {k.expiresAt ? k.expiresAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Tanpa batas"}
                          </span>
                          <span>
                            Terakhir dipakai: {k.lastUsedAt ? k.lastUsedAt.toLocaleString("id-ID") : "Belum pernah"}
                          </span>
                          <span>
                            Scopes: <span className="font-mono text-slate-600">{k.scopes.join(", ")}</span>
                          </span>
                        </div>
                      </div>

                      {canRevoke && isActive && (
                        <form
                          action={async () => {
                            "use server";
                            const s = await auth();
                            const curUser = s?.user as { id?: string; isAdmin?: boolean } | undefined;
                            if (!curUser?.id) throw new Error("Sesi tidak valid");

                            // Authorize: admin or owner can revoke
                            const targetKey = await prisma.apiKey.findUnique({
                              where: { id: k.id },
                              select: { id: true, createdById: true },
                            });
                            if (!targetKey) return;
                            if (!curUser.isAdmin && targetKey.createdById !== curUser.id) {
                              throw new Error("Tidak memiliki izin untuk mencabut key ini");
                            }

                            await prisma.apiKey.update({
                              where: { id: k.id },
                              data: { revokedAt: new Date() },
                            });
                            revalidatePath("/profile/api-keys");
                          }}
                        >
                          <button
                            type="submit"
                            className="shrink-0 text-xs text-rose-600 hover:text-rose-700 font-medium px-2.5 py-1 rounded border border-rose-200 hover:bg-rose-50 transition-colors"
                          >
                            Cabut Key (Revoke)
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </AppShell>
  );
}
