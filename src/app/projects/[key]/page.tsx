import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BugSeverity, BugStatus } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ status?: string; severity?: string; q?: string }>;
}) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; isAdmin?: boolean }
    | undefined;

  if (!user?.email || !user.id) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: {
      members: { where: { userId: user.id } },
    },
  });

  if (!project) notFound();

  const userMembership = project.members[0];
  if (!userMembership && !user.isAdmin) {
    // User does not belong to this project
    redirect("/projects");
  }

  const { status, severity, q } = await searchParams;

  const bugs = await prisma.bug.findMany({
    where: {
      projectId: project.id,
      ...(status ? { status: status as BugStatus } : {}),
      ...(severity ? { severity: severity as BugSeverity } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { key: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { name: true, email: true } },
      assignee: { select: { name: true, email: true } },
      _count: { select: { comments: true } },
    },
  });

  const role = userMembership?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="text-sm text-slate-500 hover:text-slate-900">
            ← Projects
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
            {project.key}
          </span>
          <span className="font-semibold text-slate-900 text-sm">
            {project.name}
          </span>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
            Role: {role}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${project.key}/bugs/new`}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded"
          >
            + Laporkan Bug
          </Link>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto p-6 flex-1">
        {/* Filter bar */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3 text-xs">
          <form className="flex flex-wrap items-center gap-2 flex-1">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari ID (CRM-1) atau judul..."
              className="px-3 py-1.5 border border-slate-300 rounded text-xs flex-1 min-w-[200px]"
            />

            <select
              name="status"
              defaultValue={status ?? ""}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="">Semua Status</option>
              {Object.values(BugStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              name="severity"
              defaultValue={severity ?? ""}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="">Semua Severity</option>
              {Object.values(BugSeverity).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium"
            >
              Filter
            </button>
            {(q || status || severity) && (
              <Link
                href={`/projects/${project.key}`}
                className="px-2 py-1.5 text-slate-400 hover:text-slate-600"
              >
                Reset
              </Link>
            )}
          </form>

          <span className="text-slate-400">{bugs.length} bug ditemukan</span>
        </div>

        {/* Bug Table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {bugs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              Belum ada bug yang sesuai filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 w-28">ID</th>
                  <th className="py-3 px-4">Judul Bug</th>
                  <th className="py-3 px-4 w-24">Severity</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 w-36">Assignee</th>
                  <th className="py-3 px-4 w-24">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bugs.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      <Link
                        href={`/projects/${project.key}/bugs/${b.number}`}
                        className="hover:underline text-slate-900"
                      >
                        {b.key}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <Link
                        href={`/projects/${project.key}/bugs/${b.number}`}
                        className="hover:underline"
                      >
                        {b.title}
                      </Link>
                      {b.component && (
                        <span className="ml-2 text-[10px] text-slate-400 font-normal">
                          [{b.component}]
                        </span>
                      )}
                      {b._count.comments > 0 && (
                        <span className="ml-2 text-[10px] text-slate-400">
                          💬 {b._count.comments}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          b.severity === "BLOCKER"
                            ? "bg-red-100 text-red-700"
                            : b.severity === "HIGH"
                            ? "bg-orange-100 text-orange-700"
                            : b.severity === "MEDIUM"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          b.status === "DRAFT"
                            ? "bg-purple-100 text-purple-700"
                            : b.status === "OPEN"
                            ? "bg-blue-100 text-blue-700"
                            : b.status === "IN_PROGRESS"
                            ? "bg-amber-100 text-amber-700"
                            : b.status === "READY_FOR_VERIFICATION"
                            ? "bg-teal-100 text-teal-700"
                            : b.status === "CLOSED"
                            ? "bg-emerald-100 text-emerald-700"
                            : b.status === "REOPENED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {b.assignee?.name || b.assignee?.email || "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {b.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
