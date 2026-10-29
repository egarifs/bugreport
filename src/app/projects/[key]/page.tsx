import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BugSeverity, BugStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { hasPermission } from "@/lib/permissions";
import { activeModules } from "@/lib/modules";
import { SEVERITY_STYLE, STATUS_LABEL, SeverityBadge, StatusBadge, ageDays } from "@/components/ui/bug-badges";

type View = "review" | "mine" | "all";
const DONE: BugStatus[] = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ view?: string; status?: string; severity?: string; module?: string; q?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;
  if (!user?.email || !user.id) redirect("/login");

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    include: { members: { where: { userId: user.id } } },
  });
  if (!project) notFound();
  if (!project.members[0] && !user.isAdmin) redirect("/projects");

  const role = project.members[0]?.role ?? (user.isAdmin ? "ADMIN" : "VIEWER");
  const canReview = hasPermission(role, "bug.review", user.isAdmin);
  const canWork = hasPermission(role, "bug.update", user.isAdmin);
  const canCreate = hasPermission(role, "bug.create", user.isAdmin);

  const sp = await searchParams;
  // Landing page per role: QA reviews drafts, vendor/dev sees own work, client goes to release report.
  if (!sp.view && role === "CLIENT" && !user.isAdmin) redirect(`/projects/${project.key}/reports`);
  const view: View =
    sp.view === "review" || sp.view === "mine" || sp.view === "all"
      ? sp.view
      : canReview ? "review" : canWork ? "mine" : "all";

  const status = Object.values(BugStatus).includes(sp.status as BugStatus) ? (sp.status as BugStatus) : undefined;
  const severity = Object.values(BugSeverity).includes(sp.severity as BugSeverity) ? (sp.severity as BugSeverity) : undefined;
  const q = sp.q?.trim();

  const base: Prisma.BugWhereInput = { projectId: project.id };
  const viewWhere: Prisma.BugWhereInput =
    view === "review" ? { status: "DRAFT" } : view === "mine" ? { assigneeId: user.id, status: { notIn: DONE } } : {};

  const [reviewCount, mineCount, modules, bugs] = await Promise.all([
    prisma.bug.count({ where: { ...base, status: "DRAFT" } }),
    prisma.bug.count({ where: { ...base, assigneeId: user.id, status: { notIn: DONE } } }),
    activeModules(project.id),
    prisma.bug.findMany({
      where: {
        ...base,
        ...viewWhere,
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(sp.module ? { moduleId: sp.module } : {}),
        ...(q
          ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { key: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      // Enum order in Postgres = BLOCKER..LOW, so asc puts the most severe first; then oldest first.
      orderBy: view === "all" ? [{ createdAt: "desc" }] : [{ severity: "asc" }, { createdAt: "asc" }],
      take: 200,
      include: {
        assignee: { select: { name: true, email: true } },
        module: { select: { name: true } },
        _count: { select: { comments: true } },
      },
    }),
  ]);

  const tabs: { id: View; label: string; count?: number; show: boolean }[] = [
    { id: "review", label: "Perlu review", count: reviewCount, show: canReview },
    { id: "mine", label: "Tugas saya", count: mineCount, show: canWork },
    { id: "all", label: "Semua bug", show: true },
  ];
  const href = (v: View) => `/projects/${project.key}?view=${v}`;
  const filtered = Boolean(status || severity || sp.module || q);
  const bugHref = (n: number) => `/projects/${project.key}/bugs/${n}`;
  const source = (b: (typeof bugs)[number]) => (b.agentRunId ? "Agent" : b.testRunItemId ? "Test run" : null);

  const empty =
    filtered ? "Tidak ada bug yang cocok dengan filter ini. Ubah atau reset filter."
    : view === "review" ? "Antrean review kosong. Draft baru dari form, agent, atau test run gagal akan muncul di sini."
    : view === "mine" ? "Tidak ada bug aktif yang ditugaskan ke Anda."
    : "Belum ada bug di project ini.";

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 text-base truncate">{project.name}</h1>
            <p className="text-xs text-slate-500">
              Role Anda: {role}
            </p>
          </div>
          {canCreate && (
            <Link
              href={`/projects/${project.key}/bugs/new`}
              className="shrink-0 px-3.5 py-2 bg-action hover:bg-action-hover text-white text-sm font-bold rounded"
            >
              Laporkan bug
            </Link>
          )}
        </header>

        <main className="p-4 md:p-6 flex-1">
          <nav aria-label="Tampilan bug" className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
            {tabs.filter((t) => t.show).map((t) => (
              <Link
                key={t.id}
                href={href(t.id)}
                aria-current={view === t.id ? "page" : undefined}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
                  view === t.id ? "border-action text-slate-900 font-bold" : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t.label}
                {t.count !== undefined && <span className="ml-1.5 text-slate-500 font-normal">{t.count}</span>}
              </Link>
            ))}
          </nav>

          <form className="flex flex-wrap items-center gap-2 mb-4 text-sm" role="search">
            <input type="hidden" name="view" value={view} />
            <label className="sr-only" htmlFor="q">Cari bug</label>
            <input
              id="q"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder={`Cari ID (${project.key}-1) atau judul`}
              className="px-3 py-1.5 border border-slate-300 rounded flex-1 min-w-[200px] bg-white"
            />
            <select name="severity" defaultValue={severity ?? ""} aria-label="Severity" className="px-2 py-1.5 border border-slate-300 rounded bg-white">
              <option value="">Semua severity</option>
              {Object.values(BugSeverity).map((s) => <option key={s} value={s}>{SEVERITY_STYLE[s].label}</option>)}
            </select>
            {view === "all" && (
              <select name="status" defaultValue={status ?? ""} aria-label="Status" className="px-2 py-1.5 border border-slate-300 rounded bg-white">
                <option value="">Semua status</option>
                {Object.values(BugStatus).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            )}
            {modules.length > 0 && (
              <select name="module" defaultValue={sp.module ?? ""} aria-label="Modul" className="px-2 py-1.5 border border-slate-300 rounded bg-white">
                <option value="">Semua modul</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            <button type="submit" className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 rounded font-bold">
              Terapkan
            </button>
            {filtered && <Link href={href(view)} className="px-2 py-1.5 text-slate-500 hover:text-slate-900 underline">Reset</Link>}
            <span className="ml-auto text-slate-500">{bugs.length} bug</span>
          </form>

          {bugs.length === 0 ? (
            <p className="bg-white border border-slate-200 rounded p-10 text-center text-sm text-slate-600">{empty}</p>
          ) : (
            <>
              {/* Desktop: dense table. Left strip = severity, readable at a glance. */}
              <table className="hidden md:table w-full text-left text-sm bg-white border border-slate-200 rounded overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th scope="col" className="w-[3px] p-0"><span className="sr-only">Severity</span></th>
                    <th scope="col" className="py-2 px-3 w-28 font-bold">ID</th>
                    <th scope="col" className="py-2 px-3 font-bold">Judul</th>
                    <th scope="col" className="py-2 px-3 w-24 font-bold">Severity</th>
                    <th scope="col" className="py-2 px-3 w-40 font-bold">Status</th>
                    <th scope="col" className="py-2 px-3 w-40 font-bold">Assignee</th>
                    <th scope="col" className="py-2 px-3 w-16 font-bold text-right" title="Umur bug dalam hari">Umur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bugs.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className={`p-0 ${SEVERITY_STYLE[b.severity].strip}`} />
                      <td className="py-2 px-3 font-bold whitespace-nowrap">
                        <Link href={bugHref(b.number)} className="text-action hover:underline">{b.key}</Link>
                      </td>
                      <td className="py-2 px-3">
                        <Link href={bugHref(b.number)} className="text-slate-900 hover:underline">{b.title}</Link>
                        <span className="block text-xs text-slate-500">
                          {[b.module?.name ?? (b.status === "DRAFT" ? "Modul belum diisi" : null), source(b) && `dari ${source(b)}`, b._count.comments > 0 && `${b._count.comments} komentar`]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </td>
                      <td className="py-2 px-3"><SeverityBadge severity={b.severity} /></td>
                      <td className="py-2 px-3"><StatusBadge status={b.status} /></td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[10rem]">{b.assignee?.name || b.assignee?.email || "Belum di-assign"}</td>
                      <td className="py-2 px-3 text-right text-slate-600" title={b.createdAt.toLocaleString("id-ID")}>{ageDays(b.createdAt)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile: two-line cards for vendors checking their queue. */}
              <ul className="md:hidden space-y-2">
                {bugs.map((b) => (
                  <li key={b.id}>
                    <Link href={bugHref(b.number)} className="flex bg-white border border-slate-200 rounded overflow-hidden">
                      <span className={`w-[3px] shrink-0 ${SEVERITY_STYLE[b.severity].strip}`} aria-hidden />
                      <span className="p-3 min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-action text-sm">{b.key}</span>
                          <SeverityBadge severity={b.severity} />
                          <StatusBadge status={b.status} />
                          <span className="ml-auto text-xs text-slate-500">{ageDays(b.createdAt)}h</span>
                        </span>
                        <span className="block text-sm text-slate-900">{b.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
}
