import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { hasPermission } from "@/lib/permissions";
import { requireProjectPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function NewTestRunPage({
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
      testCases: true,
    },
  });

  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");
  if (!hasPermission(project.members[0]?.role, "testrun.execute", user.isAdmin)) redirect(`/projects/${project.key}`);
  const pid = project.id;
  const pkey = project.key;

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
          <Link
            href={`/projects/${project.key}/test-cases`}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Kembali ke Test Cases
          </Link>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 text-sm">
            Buat Test Run Baru
          </span>
        </header>

        <main className="p-6 flex-1">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900 mb-1">Test Run Baru</h1>
            <p className="text-xs text-slate-500 mb-6">
              Test run akan mengikutsertakan semua ({project.testCases.length}) test case aktif di project ini untuk dieksekusi.
            </p>

            <ActionForm
              action={createTestRun.bind(null, pid)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Test Run *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Misal: Regression Release Sprint 15"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Environment *
                  </label>
                  <input
                    type="text"
                    name="environment"
                    required
                    defaultValue="Staging"
                    placeholder="Staging / Production / UAT"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Build / Version
                  </label>
                  <input
                    type="text"
                    name="buildVersion"
                    placeholder="v1.4.0 (commit ab12cd)"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <Link
                  href={`/projects/${pkey}/test-cases`}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-50"
                >
                  Batal
                </Link>
                <SubmitButton pendingText="Membuat...">Mulai test run</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </main>
      </div>
    </AppShell>
  );
}

// Module-level action: Next 15.2.1 dropped closure vars from this page's inline action.
async function createTestRun(pid: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  "use server";
  // pid is bound client-side and can be tampered with; requireProjectPermission re-checks it.
  const actor = await requireProjectPermission(pid, "testrun.execute");
  const { key: pkey } = await prisma.project.findUniqueOrThrow({ where: { id: pid }, select: { key: true } });
  const name = (formData.get("name") as string)?.trim();
  const environment = (formData.get("environment") as string)?.trim() || "Staging";
  const buildVersion = (formData.get("buildVersion") as string)?.trim() || null;

  if (!name) return { error: "Nama test run wajib diisi." };

  const allCases = await prisma.testCase.findMany({
    where: { projectId: pid },
    select: { id: true },
  });
  if (allCases.length === 0) return { error: "Project belum punya test case. Import test case dulu." };

  const testRun = await prisma.testRun.create({
    data: {
      projectId: pid,
      name,
      environment,
      buildVersion,
      createdById: actor.id,
      items: {
        create: allCases.map((tc) => ({
          testCaseId: tc.id,
          status: "NOT_RUN",
        })),
      },
    },
  });

  revalidatePath(`/projects/${pkey}/test-cases`);
  redirect(`/projects/${pkey}/test-runs/${testRun.id}`);
}
