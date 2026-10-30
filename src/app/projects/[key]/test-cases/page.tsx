import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { activeModules } from "@/lib/modules";
import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseTestCaseWorkbook } from "@/lib/testcase-importer";
import { parseMarkdownTestCases } from "@/lib/markdown-importer";
import { TestCaseManagementSection } from "./test-case-modal";

export default async function TestCasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab === "runs" ? "runs" : "cases";
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
      testCases: { orderBy: { createdAt: "desc" }, include: { module: { select: { name: true } } } },
      testRuns: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          items: true,
        },
      },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");
  if (!hasPermission(project.members[0]?.role, "testcase.read", user.isAdmin)) redirect(`/projects/${project.key}`);

  const role: ProjectRole = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canManage = hasPermission(role, "testcase.manage", user.isAdmin);
  const modules = await activeModules(project.id);

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {project.key}
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              Test Cases & Test Runs
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Import: secondary utility, tucked into native <details> dropdown */}
            {canManage && (
              <details className="relative">
                <summary className="list-none cursor-pointer select-none px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded transition">
                  Impor ▾
                </summary>
                <div className="absolute right-0 mt-1 z-30 w-80 bg-white border border-slate-200 rounded-lg shadow-lg p-3 space-y-2 text-xs">
                <p className="text-slate-600 font-medium">Impor massal: XLSX, CSV, atau Markdown (.md). Code yang sama akan di-update.</p>
                <ActionForm
                  action={async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
                    "use server";
                    await requireProjectPermission(project.id, "testcase.manage");
                    const file = formData.get("file") as File;
                    if (!file || file.size === 0) return { error: "Pilih file XLSX, CSV, atau Markdown (.md)." };
                    const fileName = file.name.toLowerCase();
                    let parsed;
                    if (fileName.endsWith(".md") || fileName.endsWith(".markdown")) {
                      const text = await file.text();
                      parsed = parseMarkdownTestCases(text);
                    } else {
                      const buffer = Buffer.from(await file.arrayBuffer());
                      parsed = parseTestCaseWorkbook(buffer);
                    }
                    if (parsed.length === 0) return { error: "Tidak ada baris test case yang terbaca. Cek format tabel/header file." };

                    const mods = await activeModules(project.id);
                    const byName = new Map(mods.map((m) => [m.name.toLowerCase(), m.id]));
                    const unknown = new Set<string>();
                    for (const item of parsed) {
                      const area = item.moduleArea?.trim();
                      const moduleId = area ? byName.get(area.toLowerCase()) ?? null : null;
                      if (area && !moduleId) unknown.add(area);
                      await prisma.testCase.upsert({
                        where: {
                          projectId_code: {
                            projectId: project.id,
                            code: item.code,
                          },
                        },
                        create: {
                          projectId: project.id,
                          code: item.code,
                          moduleArea: item.moduleArea || null,
                          moduleId,
                          title: item.title,
                          priority: item.priority,
                          testType: item.testType || null,
                          targetRole: item.targetRole || null,
                          precondition: item.precondition || null,
                          steps: item.steps || "-",
                          expectedResult: item.expectedResult || "-",
                          referenceUrl: item.referenceUrl || null,
                        },
                        update: {
                          moduleArea: item.moduleArea || null,
                          moduleId,
                          title: item.title,
                          priority: item.priority,
                          testType: item.testType || null,
                          targetRole: item.targetRole || null,
                          precondition: item.precondition || null,
                          steps: item.steps || "-",
                          expectedResult: item.expectedResult || "-",
                          referenceUrl: item.referenceUrl || null,
                        },
                      });
                    }
                    revalidatePath(`/projects/${project.key}/test-cases`);
                    const msg = `${parsed.length} test case diimpor.`;
                    return unknown.size
                      ? { error: `${msg} Modul tidak dikenal: ${[...unknown].join(", ")}.` }
                      : { ok: msg };
                  }}
                  className="flex flex-col items-start gap-2"
                >
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.csv,.md,.markdown"
                    required
                    className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-white file:border-slate-300 file:border file:text-slate-700 hover:file:bg-slate-100 cursor-pointer"
                  />
                  <SubmitButton pendingText="Mengimpor..." className="press-snappy px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded">
                    Upload XLSX/CSV/MD
                  </SubmitButton>
                </ActionForm>
                </div>
              </details>
            )}

            <Link
              href={`/projects/${project.key}/test-runs/new`}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded transition"
            >
              + Buat Test Run
            </Link>
          </div>
        </header>

        <nav className="bg-white border-b border-slate-200 px-6 flex gap-5 text-sm" aria-label="Test case tabs">
          {([["cases", `Repository (${project.testCases.length})`], ["runs", `Test Runs (${project.testRuns.length})`]] as const).map(([t, label]) => (
            <Link
              key={t}
              href={`/projects/${project.key}/test-cases${t === "runs" ? "?tab=runs" : ""}`}
              aria-current={tab === t ? "page" : undefined}
              className={`py-2.5 border-b-2 -mb-px ${tab === t ? "border-slate-900 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <main className="p-6 space-y-8 flex-1 min-w-0">
          {tab === "runs" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Test Runs Terbaru</h2>
              <span className="text-xs text-slate-500">5 run terakhir</span>
            </div>

            {project.testRuns.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
                Belum ada test run dibuat. Buat test run untuk mulai eksekusi pengujian release.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {project.testRuns.map((r) => {
                  const passCount = r.items.filter((i) => i.status === "PASS").length;
                  const failCount = r.items.filter((i) => i.status === "FAIL").length;
                  const total = r.items.length;
                  return (
                    <Link
                      key={r.id}
                      href={`/projects/${project.key}/test-runs/${r.id}`}
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 block shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-sm text-slate-900">{r.name}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {r.environment}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Build: {r.buildVersion || "-"}</p>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-600">{total} test cases</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-700 font-medium">{passCount} Pass</span>
                          <span className="text-rose-600 font-medium">{failCount} Fail</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {/* Test Cases Repository section with Client Interactive Modal */}
          {tab === "cases" && (
          <section>
            <TestCaseManagementSection
              projectId={project.id}
              projectKey={project.key}
              canManage={canManage}
              modules={modules.map((m) => ({ id: m.id, name: m.name }))}
              testCases={project.testCases.map((tc) => ({
                id: tc.id,
                code: tc.code,
                title: tc.title,
                priority: tc.priority,
                moduleId: tc.moduleId,
                moduleArea: tc.moduleArea,
                moduleName: tc.module?.name ?? null,
                testType: tc.testType,
                targetRole: tc.targetRole,
                precondition: tc.precondition,
                steps: tc.steps,
                expectedResult: tc.expectedResult,
                referenceUrl: tc.referenceUrl,
              }))}
            />
          </section>
          )}
        </main>
      </div>
    </AppShell>
  );
}
