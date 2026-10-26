import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; isAdmin?: boolean; name?: string }
    | undefined;

  if (!user?.email || !user.id) {
    redirect("/login");
  }

  // Admin sees all projects; regular users only see assigned projects
  const projects = user.isAdmin
    ? await prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { bugs: true, members: true } },
        },
      })
    : (
        await prisma.projectMember.findMany({
          where: { userId: user.id },
          include: {
            project: {
              include: {
                _count: { select: { bugs: true, members: true } },
              },
            },
          },
        })
      ).map((m) => m.project);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-1.5 bg-slate-900 text-white rounded font-mono font-bold text-sm">
            BR
          </span>
          <span className="font-semibold text-slate-900">BugReport</span>
          {user.isAdmin && (
            <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded">
              Admin
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          {user.isAdmin && (
            <Link
              href="/admin/users"
              className="text-slate-600 hover:text-slate-900 text-xs font-medium"
            >
              Approval Queue
            </Link>
          )}
          <span className="text-xs text-slate-500">{user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-xs text-slate-600 hover:text-red-600"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto p-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Daftar Project</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih project untuk melihat dan melaporkan bug.
            </p>
          </div>

          {user.isAdmin && (
            <Link
              href="/projects/new"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded"
            >
              + Project Baru
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <p className="text-sm text-slate-600 mb-2">
              Belum ada project yang di-assign untuk akun Anda.
            </p>
            <p className="text-xs text-slate-400">
              Hubungi Administrator untuk mendapatkan akses ke project terkait.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.key}`}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-5 transition block shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wide">
                      {p.key}
                    </span>
                    <h2 className="text-base font-semibold text-slate-900 mt-1">
                      {p.name}
                    </h2>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                    {p.description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                  <span>{p._count.bugs} bug</span>
                  <span>•</span>
                  <span>{p._count.members} anggota</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
