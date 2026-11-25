import { RunProgressBar, RunStateIcon } from "@/components/ui/run-state-indicator";
import { countsOf, testRunState } from "@/lib/test-run-state";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { activeModules } from "@/lib/modules";
import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseTestCaseWorkbook } from "@/lib/testcase-importer";
import { parseMarkdownTestCases } from "@/lib/markdown-importer";
import { saveTestCaseCore } from "@/lib/testcase-service";
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
      testCases: {
        orderBy: { createdAt: "desc" },
        include: {
          module: { select: { id: true, name: true } },
          runItems: {
            orderBy: { testRun: { createdAt: "desc" } },
            take: 1,
            include: {
              testRun: { select: { id: true, name: true } },
              bugLinks: {
                take: 1,
                include: { bug: { select: { key: true, number: true } } },
              },
            },
          },
        },
      },
      testRuns: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          items: true,
        },
      },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");
  if (!hasPermission(project.members[0]?.role, "testcase.read", user.isAdmin)) return <ForbiddenState projectKey={project.key} />;

  const role: ProjectRole = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canManage = hasPermission(role, "testcase.manage", user.isAdmin);
  const modules = await activeModules(project.id);

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        {/* Header matching Mockup 23 */}
        <header className="bg-surface border-b border-border-base px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-xl font-bold text-text-base">Test case</h1>
            <div
              role="tablist"
              aria-label="Bagian test case"
              className="inline-flex p-1 rounded-lg bg-surface-sunken gap-1 text-xs font-semibold"
            >
              <Link
                href={`/projects/${project.key}/test-cases`}
                role="tab"
                aria-selected={tab === "cases"}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  tab === "cases"
                    ? "bg-surface-raised text-text-base shadow-xs font-bold"
                    : "text-text-muted hover:text-text-base"
                }`}
              >
                <span>Repository</span>
                <span className="font-mono text-[11px] text-text-muted">{project.testCases.length}</span>
              </Link>
              <Link
                href={`/projects/${project.key}/test-cases?tab=runs`}
                role="tab"
                aria-selected={tab === "runs"}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                  tab === "runs"
                    ? "bg-surface-raised text-text-base shadow-xs font-bold"
                    : "text-text-muted hover:text-text-base"
                }`}
              >
                <span>Test run</span>
                <span className="font-mono text-[11px] text-text-muted">{project.testRuns.length}</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {canManage && (
              <details className="relative">
                <summary className="list-none cursor-pointer select-none px-3.5 py-2 bg-surface-raised border border-border-base hover:bg-surface-sunken text-text-base text-xs font-semibold rounded-lg transition min-h-[38px] flex items-center">
                  Impor ▾
                </summary>
                <div className="absolute right-0 mt-1 z-30 w-80 bg-surface-raised border border-border-base rounded-lg shadow-xl p-3 space-y-2 text-xs">
                  <p className="text-text-muted font-medium">
                    Impor massal: XLSX, CSV, atau Markdown (.md). Kode yang sama akan diperbarui.
                  </p>
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
                      if (parsed.length === 0)
                        return { error: "Tidak ada baris test case yang terbaca. Cek format tabel/header file." };

                      const mods = await activeModules(project.id);
                      const byName = new Map(mods.map((m) => [m.name.toLowerCase(), m.id]));
                      const unknown = new Set<string>();
                      for (const item of parsed) {
                        const area = item.moduleArea?.trim();
                        const moduleId = area ? byName.get(area.toLowerCase()) ?? null : null;
                        if (area && !moduleId) unknown.add(area);
                        await saveTestCaseCore(project.id, project.key, {
                          code: item.code,
                          moduleId,
                          title: item.title,
                          priority: item.priority,
                          testType: item.testType || null,
                          targetRole: item.targetRole || null,
                          precondition: item.precondition || null,
                          steps: item.steps || "-",
                          expectedResult: item.expectedResult || "-",
                          referenceUrl: item.referenceUrl || null,
                          changelog: "Diimpor dari file",
                          userId: user.id,
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
                      className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-surface-sunken file:border-border-base file:border file:text-text-base hover:file:bg-surface-raised cursor-pointer"
                    />
                    <SubmitButton
                      pendingText="Mengimpor..."
                      className="press-snappy px-3 py-1.5 bg-surface-raised border border-border-base hover:bg-surface-sunken text-text-base text-xs font-semibold rounded"
                    >
                      Upload XLSX/CSV/MD
                    </SubmitButton>
                  </ActionForm>
                </div>
              </details>
            )}

            {canManage && (
              <Link
                href={`/projects/${project.key}/test-cases/new`}
                className="px-4 py-2 bg-action hover:bg-action-hover text-on-action text-xs font-bold rounded-lg shadow-sm transition min-h-[38px] flex items-center"
              >
                Test case baru
              </Link>
            )}
            <Link
              href={`/projects/${project.key}/test-runs/new`}
              className="px-3.5 py-2 bg-surface-raised border border-border-base hover:bg-surface-sunken text-text-base text-xs font-semibold rounded-lg transition min-h-[38px] flex items-center"
            >
              + Buat Test Run
            </Link>
          </div>
        </header>

        <main className="p-6 space-y-8 flex-1 min-w-0">
          {tab === "runs" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Test Runs Terbaru</h2>
              <span className="text-xs text-slate-500">5 run terakhir</span>
            </div>

            {project.testRuns.length === 0 ? (
              <div className="bg-surface border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
                Belum ada test run dibuat. Buat test run untuk mulai eksekusi pengujian release.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {project.testRuns.map((r) => {
                  const passCount = r.items.filter((i) => i.status === "PASS").length;
                  const failCount = r.items.filter((i) => i.status === "FAIL").length;
                  const total = r.items.length;
                  const counts = countsOf(r.items);
                  const state = testRunState({ status: r.status, decision: r.decision, counts, hasActiveLease: r.items.some((i) => i.leaseExpiresAt && i.leaseExpiresAt.getTime() > Date.now()) });
                  return (
                    <Link
                      key={r.id}
                      href={`/projects/${project.key}/test-runs/${r.id}`}
                      className="bg-surface border border-slate-200 hover:border-slate-300 rounded-lg p-4 block shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <span className="flex items-center gap-2 min-w-0"><RunStateIcon kind={state.kind} /><span className="font-semibold text-sm text-slate-900 truncate">{r.name}</span></span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-action-soft text-link">
                          {r.environment}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Build: {r.buildVersion || "-"} · {state.label} {state.total > 0 && <span className="font-mono">{state.done}/{state.total}</span>}</p>
                      <div className="mt-2"><RunProgressBar counts={counts} active={state.kind === "running" || state.kind === "waiting"} /></div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-600">{total} test cases</span>
                        <div className="flex items-center gap-2">
                          <span className="text-ok font-medium">{passCount} Pass</span>
                          <span className="text-bad font-medium">{failCount} Fail</span>
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
              testCases={project.testCases.map((tc) => {
                const stepCount = tc.steps ? tc.steps.split(/\n+/).filter((s) => s.trim().length > 0).length : 0;
                const lastRunItem = tc.runItems[0] ?? null;
                const linkedBug = lastRunItem?.bugLinks[0]?.bug ?? null;
                return {
                  id: tc.id,
                  code: tc.code,
                  title: tc.title,
                  priority: tc.priority,
                  status: tc.status,
                  moduleId: tc.moduleId,
                  moduleArea: tc.moduleArea,
                  moduleName: tc.module?.name ?? null,
                  testType: tc.testType,
                  targetRole: tc.targetRole,
                  precondition: tc.precondition,
                  steps: tc.steps,
                  expectedResult: tc.expectedResult,
                  referenceUrl: tc.referenceUrl,
                  stepCount,
                  lastResult: lastRunItem
                    ? {
                        status: lastRunItem.status,
                        runName: lastRunItem.testRun?.name,
                        runId: lastRunItem.testRun?.id,
                      }
                    : null,
                  linkedBug: linkedBug
                    ? {
                        key: linkedBug.key,
                        number: linkedBug.number,
                      }
                    : null,
                };
              })}
            />
          </section>
          )}
        </main>
      </div>
    </AppShell>
  );
}
