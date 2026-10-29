import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { ProjectRole, TestRunItemStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createBugDraftFromTestRunItem } from "@/lib/testrun-service";

export default async function TestRunDetailPage({
  params,
}: {
  params: Promise<{ key: string; runId: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.id || !user.email) redirect("/login");

  const { key, runId } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");
  if (!hasPermission(project.members[0]?.role, "testcase.read", user.isAdmin)) redirect(`/projects/${project.key}`);

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    include: {
      items: {
        include: {
          testCase: { include: { module: { select: { name: true } } } },
          createdBug: true,
          executedBy: { select: { name: true, email: true } },
        },
        orderBy: { testCase: { code: "asc" } },
      },
    },
  });

  if (!run || run.projectId !== project.id) notFound();

  const role: ProjectRole = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canExecute = hasPermission(role, "testrun.execute", user.isAdmin);

  const total = run.items.length;
  const passCount = run.items.filter((i) => i.status === "PASS").length;
  const failCount = run.items.filter((i) => i.status === "FAIL").length;
  const blockedCount = run.items.filter((i) => i.status === "BLOCKED").length;
  const notRunCount = run.items.filter((i) => i.status === "NOT_RUN").length;

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${project.key}/test-cases`}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← Test Runs
            </Link>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900 text-sm">
              {run.name}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              {run.environment}
            </span>
            {run.buildVersion && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {run.buildVersion}
              </span>
            )}
          </div>
        </header>

        <main className="p-6 space-y-6 flex-1">
          {/* Summary status cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <span className="text-xs text-slate-500">Total Cases</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{total}</p>
            </div>
            <div className="bg-white border border-emerald-200 rounded-lg p-3">
              <span className="text-xs text-emerald-700">Passed</span>
              <p className="text-xl font-bold text-emerald-700 mt-0.5">{passCount}</p>
            </div>
            <div className="bg-white border border-rose-200 rounded-lg p-3">
              <span className="text-xs text-rose-600">Failed</span>
              <p className="text-xl font-bold text-rose-700 mt-0.5">{failCount}</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-lg p-3">
              <span className="text-xs text-amber-700">Blocked</span>
              <p className="text-xl font-bold text-amber-700 mt-0.5">{blockedCount}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <span className="text-xs text-slate-500">Not Run</span>
              <p className="text-xl font-bold text-slate-700 mt-0.5">{notRunCount}</p>
            </div>
          </div>

          {/* Test cases execution table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {run.items.map((item) => (
                <div key={item.id} className="p-4 hover:bg-slate-50/50 transition">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {item.testCase.code}
                        </span>
                        {(item.testCase.module?.name ?? item.testCase.moduleArea) && (
                          <span className="text-xs text-slate-500">{item.testCase.module?.name ?? item.testCase.moduleArea}</span>
                        )}
                        <span className="font-semibold text-sm text-slate-900">
                          {item.testCase.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            item.status === "PASS"
                              ? "bg-emerald-100 text-emerald-700"
                              : item.status === "FAIL"
                              ? "bg-rose-100 text-rose-700"
                              : item.status === "BLOCKED"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 pl-1">
                        <div>
                          <strong className="text-slate-700">Langkah:</strong>{" "}
                          <span className="whitespace-pre-line">{item.testCase.steps}</span>
                        </div>
                        <div>
                          <strong className="text-slate-700">Ekspektasi:</strong>{" "}
                          {item.testCase.expectedResult}
                        </div>
                        {item.actualResult && (
                          <div className="text-rose-700">
                            <strong>Hasil Aktual:</strong> {item.actualResult}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Form */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {canExecute && (
                        <form
                          action={async (formData: FormData) => {
                            "use server";
                            const actor = await requireProjectPermission(project.id, "testrun.execute");
                            const status = formData.get("status") as TestRunItemStatus;
                            if (!Object.values(TestRunItemStatus).includes(status)) return;
                            const actual = (formData.get("actualResult") as string)?.trim() || null;

                            await prisma.testRunItem.update({
                              where: { id: item.id },
                              data: {
                                status,
                                actualResult: actual,
                                executedById: actor.id,
                                executedAt: new Date(),
                              },
                            });
                            revalidatePath(`/projects/${project.key}/test-runs/${run.id}`);
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            name="actualResult"
                            defaultValue={item.actualResult || ""}
                            placeholder="Catatan hasil..."
                            className="text-xs px-2 py-1 border border-slate-300 rounded outline-none w-36"
                          />
                          <button
                            type="submit"
                            name="status"
                            value="PASS"
                            className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
                          >
                            Pass
                          </button>
                          <button
                            type="submit"
                            name="status"
                            value="FAIL"
                            className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded font-medium"
                          >
                            Fail
                          </button>
                          <button
                            type="submit"
                            name="status"
                            value="BLOCKED"
                            className="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded font-medium"
                          >
                            Blocked
                          </button>
                        </form>
                      )}

                      {/* Bridge to Bug Draft */}
                      {item.status === "FAIL" && (
                        <div className="mt-1">
                          {item.createdBug ? (
                            <Link
                              href={`/projects/${project.key}/bugs/${item.createdBug.number}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-semibold hover:bg-purple-100 transition"
                            >
                              <span>Bug Draft:</span>
                              <span className="font-mono">{item.createdBug.key}</span>
                            </Link>
                          ) : (
                            <form
                              action={async () => {
                                "use server";
                                const actor = await requireProjectPermission(project.id, "bug.create");
                                await createBugDraftFromTestRunItem({
                                  testRunItemId: item.id,
                                  actorId: actor.id,
                                  actorEmail: actor.email,
                                  isAdmin: actor.isAdmin,
                                });
                                revalidatePath(`/projects/${project.key}/test-runs/${run.id}`);
                              }}
                            >
                              <button
                                type="submit"
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow-sm transition"
                              >
                                + Create Bug Draft
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
