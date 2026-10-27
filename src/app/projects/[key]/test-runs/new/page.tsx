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
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 text-sm">
            Buat Test Run Baru
          </span>
        </header>

        <main className="max-w-xl w-full mx-auto p-6 flex-1">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900 mb-1">Test Run Baru</h1>
            <p className="text-xs text-slate-500 mb-6">
              Test run akan mengikutsertakan semua ({project.testCases.length}) test case aktif di project ini untuk dieksekusi.
            </p>

            <form
              action={async (formData: FormData) => {
                "use server";
                const name = (formData.get("name") as string)?.trim();
                const environment = (formData.get("environment") as string)?.trim() || "Staging";
                const buildVersion = (formData.get("buildVersion") as string)?.trim() || null;

                if (!name) return;

                const allCases = await prisma.testCase.findMany({
                  where: { projectId: project.id },
                  select: { id: true },
                });

                const testRun = await prisma.testRun.create({
                  data: {
                    projectId: project.id,
                    name,
                    environment,
                    buildVersion,
                    createdById: user.id as string,
                    items: {
                      create: allCases.map((tc) => ({
                        testCaseId: tc.id,
                        status: "NOT_RUN",
                      })),
                    },
                  },
                });

                revalidatePath(`/projects/${project.key}/test-cases`);
                redirect(`/projects/${project.key}/test-runs/${testRun.id}`);
              }}
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
                  href={`/projects/${project.key}/test-cases`}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-50"
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition"
                >
                  Mulai Test Run
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
