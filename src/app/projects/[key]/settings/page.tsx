import { SubmitButton } from "@/components/ui/action-form";
import { ModulesSection } from "./modules-section";
import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { dailyTokenQuota, projectTokensToday } from "@/lib/chat-quota";
import { ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { generateApiKey } from "@/lib/mcp-auth";

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ newKey?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key } = await params;
  const sp = await searchParams;
  const newCreatedKey = sp.newKey;

  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: {
        include: { user: true },
      },
      apiKeys: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: true },
      },
      agentRuns: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          createdBugs: { select: { id: true, key: true, title: true, status: true } },
        },
      },
    },
  });

  if (!project) notFound();
  const membership = project.members.find((m) => m.userId === user.id);
  if (!membership && !user.isAdmin) redirect("/projects");

  const role: ProjectRole = membership?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canManage = hasPermission(role, "project.manage", user.isAdmin);
  const [aiUsed, aiQuota] = [await projectTokensToday(project.id), dailyTokenQuota()];
  const aiPct = Math.min(100, Math.round((aiUsed / aiQuota) * 100));

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {project.key}
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              Project Settings & AI Agent Keys
            </span>
          </div>
        </header>

        <main className="p-6 space-y-8 flex-1">
          {/* Freshly Generated API Key Notice */}
          {newCreatedKey && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs">
              <h3 className="font-bold text-amber-900 mb-1">
                Simpan API Key Anda Sekarang
              </h3>
              <p className="text-amber-800 mb-2">
                Key ini hanya ditampilkan sekali. Gunakan untuk otentikasi MCP Server di Claude Code atau agent reporter CI/CD.
              </p>
              <div className="font-mono bg-white border border-amber-300 p-2.5 rounded select-all text-amber-950 font-bold break-all">
                {newCreatedKey}
              </div>
            </div>
          )}

          <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Pemakaian AI Chat hari ini</h2>
            <p className="text-xs text-slate-500 mb-3">Kuota token per project, reset 00:00 WIB. Ubah lewat env <code>CHAT_DAILY_TOKENS_PER_PROJECT</code>.</p>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="font-mono tabular-nums text-slate-900">{aiUsed.toLocaleString("id-ID")} / {aiQuota.toLocaleString("id-ID")} token</span>
              <span className={aiPct >= 90 ? "font-bold text-rose-700" : "text-slate-500"}>{aiPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={aiPct} aria-valuemin={0} aria-valuemax={100} aria-label="Pemakaian kuota AI">
              <div className={`h-full ${aiPct >= 90 ? "bg-rose-600" : "bg-slate-900"}`} style={{ width: `${aiPct}%` }} />
            </div>
          </section>

          <ModulesSection projectId={project.id} projectKey={project.key} canManage={canManage} />

          {/* AI Agent API Keys Section (CRUD vs View Only Mode) */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    AI Agent API Keys (MCP Protocol)
                  </h2>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${canManage ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {canManage ? "Mode CRUD (Admin)" : "Mode View Only"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kunci akses MCP CLI agent (Claude Code / Pi CLI / Playwright). Rate limit 30 req/mnt.
                </p>
              </div>

              {/* Mode Create: Hanya untuk Admin / project.manage */}
              {canManage && (
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const actor = await requireProjectPermission(project.id, "project.manage");
                    const name = (formData.get("name") as string)?.trim();
                    if (!name) return;

                    const roleStr = (formData.get("role") as string) || "QA";
                    const role = (["QA", "DEVELOPER", "VENDOR", "VIEWER"].includes(roleStr) ? roleStr : "QA") as ProjectRole;

                    const expireDays = Number(formData.get("expireDays")) || 30;
                    let expiresAt: Date | null = null;
                    if (expireDays > 0) {
                      expiresAt = new Date(Date.now() + expireDays * 86400_000);
                    }

                    const { rawKey, keyHash, keyPrefix } = generateApiKey();

                    const scopes = role === "QA"
                      ? ["bug:read", "bug:create", "bug:comment", "bug:attach", "testcase:create", "testcase:read", "doc:read", "doc:manage"]
                      : ["bug:read", "bug:comment", "testcase:read", "doc:read"];

                    await prisma.apiKey.create({
                      data: {
                        projectId: project.id,
                        name,
                        keyHash,
                        keyPrefix,
                        role,
                        expiresAt,
                        scopes,
                        createdById: actor.id,
                      },
                    });

                    redirect(`/projects/${project.key}/settings?newKey=${rawKey}`);
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Nama agent (misal: Pi CLI QA)"
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded outline-none w-44"
                  />
                  <select
                    name="role"
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-700 outline-none"
                    title="Akses Role Agent"
                  >
                    <option value="QA">Role: QA (Full CRUD)</option>
                    <option value="DEVELOPER">Role: Non-QA (View & Comment)</option>
                  </select>
                  <select
                    name="expireDays"
                    defaultValue="30"
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-700 outline-none"
                    title="Masa Berlaku Key"
                  >
                    <option value="7">Berlaku 7 hari</option>
                    <option value="30">Berlaku 30 hari</option>
                    <option value="90">Berlaku 90 hari</option>
                    <option value="0">Tanpa batas (Never)</option>
                  </select>
                  <SubmitButton pendingText="Membuat..." className="px-3.5 py-1.5 bg-action hover:bg-action-hover text-white text-xs font-bold rounded">
                    + Buat Key
                  </SubmitButton>
                </form>
              )}
            </div>

            {project.apiKeys.length === 0 ? (
              <div className="text-xs text-slate-400 p-8 text-center border border-dashed rounded">
                Belum ada API Key dibuat di project ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {project.apiKeys.map((k) => {
                  const isRevoked = Boolean(k.revokedAt);
                  const isExpired = !isRevoked && Boolean(k.expiresAt && k.expiresAt < new Date());
                  const isActive = !isRevoked && !isExpired;

                  return (
                    <div key={k.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs">{k.name}</span>
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                            {k.keyPrefix}...
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            k.role === "QA" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                          }`}>
                            {k.role === "QA" ? "QA (CRUD)" : "Non-QA (View)"}
                          </span>
                          {isRevoked ? (
                            <span className="text-[11px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-semibold">
                              Revoked
                            </span>
                          ) : isExpired ? (
                            <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                              Expired
                            </span>
                          ) : (
                            <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Pembuat: <span className="font-medium text-slate-700">{k.createdBy.name || k.createdBy.email}</span>
                          {" • "}
                          Kadaluwarsa:{" "}
                          <span className={isExpired ? "text-rose-600 font-semibold" : "text-slate-700"}>
                            {k.expiresAt ? k.expiresAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Tanpa batas"}
                          </span>
                          {" • "}
                          Terakhir dipakai: {k.lastUsedAt ? k.lastUsedAt.toLocaleString("id-ID") : "Belum pernah"}
                        </p>
                      </div>

                      {/* Mode Aksi: Revoke hanya di Mode CRUD & status Active */}
                      {canManage && isActive && (
                        <form
                          action={async () => {
                            "use server";
                            await requireProjectPermission(project.id, "project.manage");
                            await prisma.apiKey.update({
                              where: { id: k.id },
                              data: { revokedAt: new Date() },
                            });
                            revalidatePath(`/projects/${project.key}/settings`);
                          }}
                        >
                          <button
                            type="submit"
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50"
                          >
                            Revoke Key
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* AI Agent Runs Section */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Riwayat Eksekusi AI Agent (Agent Runs)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Menampilkan daftar bug Draft yang dilaporkan otomatis oleh agent CI/CD.
            </p>

            {project.agentRuns.length === 0 ? (
              <div className="text-xs text-slate-400 p-6 text-center border border-dashed rounded">
                Belum ada aktivitas laporan dari AI agent untuk project ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {project.agentRuns.map((r) => (
                  <div key={r.id} className="py-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-xs">{r.agentName}</span>
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          run: {r.runId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-500">Bug dihasilkan:</span>
                        {r.createdBugs.length === 0 ? (
                          <span className="text-xs text-slate-400">Tidak ada bug dibuat</span>
                        ) : (
                          r.createdBugs.map((b) => (
                            <span
                              key={b.id}
                              className="font-mono text-xs font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200"
                            >
                              {b.key} ({b.status})
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {r.createdAt.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </AppShell>
  );
}
