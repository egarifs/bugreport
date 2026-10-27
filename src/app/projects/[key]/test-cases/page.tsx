import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { ProjectRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseTestCaseWorkbook } from "@/lib/testcase-importer";

export default async function TestCasesPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
      testCases: { orderBy: { createdAt: "desc" } },
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

  const role: ProjectRole = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canManage = hasPermission(role, "testcase.manage", user.isAdmin);

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
            <Link
              href={`/projects/${project.key}/test-runs/new`}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded transition"
            >
              + Buat Test Run
            </Link>
          </div>
        </header>

        <main className="max-w-6xl w-full mx-auto p-6 space-y-8 flex-1">
          {/* Active Test Runs section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Test Runs Aktif</h2>
              <span className="text-xs text-slate-500">{project.testRuns.length} total run</span>
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
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {r.environment}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Build: {r.buildVersion || "-"}</p>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-600">{total} test cases</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 font-medium">{passCount} Pass</span>
                          <span className="text-rose-600 font-medium">{failCount} Fail</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Test Cases Repository section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Test Case Repository</h2>
                <p className="text-xs text-slate-500">
                  Total {project.testCases.length} skenario pengujian terdaftar.
                </p>
              </div>

              {canManage && (
                <div className="flex items-center gap-3">
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const file = formData.get("file") as File;
                      if (!file || file.size === 0) return;
                      const buffer = Buffer.from(await file.arrayBuffer());
                      const parsed = parseTestCaseWorkbook(buffer);

                      for (const item of parsed) {
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
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="file"
                      name="file"
                      accept=".xlsx,.csv"
                      required
                      className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition"
                    >
                      Import XLSX/CSV
                    </button>
                  </form>
                </div>
              )}
            </div>

            {project.testCases.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-500">
                Belum ada test case di project ini. Gunakan tombol import di atas dengan file format template Google Sheet / Excel CRM.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Area / Modul</th>
                      <th className="py-3 px-4">Judul Test Case</th>
                      <th className="py-3 px-4">Prioritas</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Expected Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {project.testCases.map((tc) => (
                      <tr key={tc.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {tc.code}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {tc.moduleArea || "-"}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {tc.title}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              tc.priority === "CRITICAL"
                                ? "bg-red-100 text-red-700"
                                : tc.priority === "HIGH"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {tc.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {tc.targetRole || "-"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {tc.expectedResult}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </AppShell>
  );
}
