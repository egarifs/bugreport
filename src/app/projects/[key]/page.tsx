import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BugPriority, BugSeverity, BugStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { hasPermission } from "@/lib/permissions";
import { activeModules } from "@/lib/modules";
import { SEVERITY_STYLE, STATUS_LABEL, SeverityBadge, StatusBadge } from "@/components/ui/bug-badges";
import { StatePanel } from "@/components/ui/state-panel";
import { SlaBadge } from "@/components/ui/sla-badge";
import { BugImportModal } from "./bugs/import/bug-import-modal";
import { parseMarkdownBugs } from "@/lib/markdown-importer";
import { requireProjectPermission } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { ActionForm, type ActionResult } from "@/components/ui/action-form";
import { triageBug, startOfTodayWib } from "@/lib/triage-service";
import { TriageKeys } from "./triage-keys";

type View = "review" | "mine" | "all";
const DONE: BugStatus[] = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ done?: string; sel?: string; view?: string; status?: string; severity?: string; module?: string; q?: string }>;
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

  const today = startOfTodayWib();
  const [reviewCount, mineCount, modules, members, reviewedToday, closedToday, bugs] = await Promise.all([
    prisma.bug.count({ where: { ...base, status: "DRAFT" } }),
    prisma.bug.count({ where: { ...base, assigneeId: user.id, status: { notIn: DONE } } }),
    activeModules(project.id),
    canReview
      ? prisma.projectMember.findMany({ where: { projectId: project.id }, include: { user: { select: { name: true, email: true } } } })
      : Promise.resolve([]),
    canReview ? prisma.bug.count({ where: { ...base, reviewedAt: { gte: today } } }) : Promise.resolve(0),
    canReview
      ? prisma.auditLog.count({ where: { projectId: project.id, action: "bug.status_change", createdAt: { gte: today }, changes: { path: ["after", "status"], equals: "CLOSED" } } })
      : Promise.resolve(0),
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
        _count: { select: { comments: true, testRunLinks: true } },
      },
    }),
  ]);

  const tabs: { id: View; label: string; count?: number; show: boolean }[] = [
    { id: "review", label: "Perlu review", count: reviewCount, show: canReview },
    { id: "mine", label: "Tugas saya", count: mineCount, show: canWork },
    { id: "all", label: "Semua bug", show: true },
  ];
  const href = (v: View) => `/projects/${project.key}?view=${v}`;
  const selHref = (k: string) => {
    const p = new URLSearchParams();
    for (const [n, v] of Object.entries({ view: view, status, severity, module: sp.module, q })) if (v) p.set(n, v);
    p.set("sel", k);
    return `/projects/${project.key}?${p}`;
  };
  const selected = bugs.find((b) => b.key === sp.sel) ?? null;
  const filtered = Boolean(status || severity || sp.module || q);
  const bugHref = (n: number) => `/projects/${project.key}/bugs/${n}`;
  const source = (b: (typeof bugs)[number]) => (b.agentRunId ? "Agent" : b._count.testRunLinks ? "Test run" : null);

  const empty =
    filtered ? "Tidak ada bug yang cocok dengan filter ini. Ubah atau reset filter."
    : view === "review" ? "Antrean review kosong. Draft baru dari form, agent, atau test run gagal akan muncul di sini."
    : view === "mine" ? "Tidak ada bug aktif yang ditugaskan ke Anda."
    : "Belum ada bug di project ini.";

  const projectId = project.id;
  const projectKey = project.key;
  const userId = user.id;

  async function handleTriage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    const actor = await requireProjectPermission(projectId, "bug.review");
    const intent = formData.get("intent");
    const res = await triageBug(actor, projectId, String(formData.get("bugId")), {
      severity: String(formData.get("severity") ?? ""),
      priority: String(formData.get("priority") ?? ""),
      moduleId: String(formData.get("moduleId") ?? ""),
      assigneeId: String(formData.get("assigneeId") ?? ""),
      accept: intent === "accept",
      reject: intent === "reject",
    });
    revalidatePath(`/projects/${projectKey}`);
    if ("ok" in res && (intent === "accept" || intent === "reject")) {
      redirect(`/projects/${projectKey}?view=review&done=${encodeURIComponent(res.ok!)}`);
    }
    return res;
  }

  async function handleImportMarkdownBugs(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    "use server";
    await requireProjectPermission(projectId, "bug.create");
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "Pilih file Markdown (.md)." };

    const text = await file.text();
    const parsed = parseMarkdownBugs(text);
    if (parsed.length === 0) return { error: "Tidak ada bug yang terbaca. Cek format tabel / heading file Markdown." };

    const mods = await activeModules(projectId);
    const byName = new Map(mods.map((m) => [m.name.toLowerCase(), m.id]));

    // Sequential bug numbering
    let createdCount = 0;
    for (const b of parsed) {
      const area = b.moduleArea?.trim();
      const moduleId = area ? byName.get(area.toLowerCase()) ?? null : null;

      const lastBug = await prisma.bug.findFirst({
        where: { projectId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const nextNumber = (lastBug?.number ?? 0) + 1;

      await prisma.bug.create({
        data: {
          projectId,
          key: `${projectKey}-${nextNumber}`,
          number: nextNumber,
          title: b.title.slice(0, 200),
          severity: b.severity,
          status: BugStatus.DRAFT,
          reporterId: userId!,
          moduleId,
          stepsToReproduce: b.stepsToReproduce || "-",
          actualResult: b.actualResult || "-",
          expectedResult: b.expectedResult || "-",
        },
      });
      createdCount++;
    }

    revalidatePath(`/projects/${projectKey}`);
    return { ok: `Berhasil mengimpor ${createdCount} bug sebagai Draft.` };
  }

  return (
    <AppShell activeProjectKey={project.key}>
      <div className="min-h-full flex flex-col">
        <header className="bg-surface border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 text-base truncate">{project.name}</h1>
            <p className="text-xs text-slate-500">
              Role Anda: {role}
            </p>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <BugImportModal importAction={handleImportMarkdownBugs} />
              <Link
                href={`/projects/${project.key}/bugs/new`}
                className="shrink-0 px-3.5 py-2 bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded"
              >
                Laporkan bug
              </Link>
            </div>
          )}
        </header>

        <main className="p-4 md:p-6 flex-1">
          {sp.done && <p role="status" className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded">{sp.done.slice(0, 120)}</p>}
          {canReview && (
            <div aria-label="Ringkasan hari ini" className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-4 px-4 py-2.5 bg-surface border border-slate-200 rounded text-sm">
              <span className="font-bold text-slate-900">Hari ini</span>
              <span className="text-slate-700"><b className="font-mono">{reviewedToday}</b> direview</span>
              <span className="text-slate-700"><b className="font-mono">{closedToday}</b> ditutup</span>
              <span className="ml-auto text-xs text-slate-500">Reset pukul 00.00 WIB</span>
            </div>
          )}
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
              className="px-3 py-1.5 border border-slate-300 rounded flex-1 min-w-[200px] bg-surface"
            />
            <select name="severity" defaultValue={severity ?? ""} aria-label="Severity" className="px-2 py-1.5 border border-slate-300 rounded bg-surface">
              <option value="">Semua severity</option>
              {Object.values(BugSeverity).map((s) => <option key={s} value={s}>{SEVERITY_STYLE[s].label}</option>)}
            </select>
            {view === "all" && (
              <select name="status" defaultValue={status ?? ""} aria-label="Status" className="px-2 py-1.5 border border-slate-300 rounded bg-surface">
                <option value="">Semua status</option>
                {Object.values(BugStatus).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            )}
            {modules.length > 0 && (
              <select name="module" defaultValue={sp.module ?? ""} aria-label="Modul" className="px-2 py-1.5 border border-slate-300 rounded bg-surface">
                <option value="">Semua modul</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            <button type="submit" className="px-3 py-1.5 border border-slate-300 bg-surface hover:bg-slate-100 rounded font-bold">
              Terapkan
            </button>
            {filtered && <Link href={href(view)} className="px-2 py-1.5 text-slate-500 hover:text-slate-900 underline">Reset</Link>}
            <span className="ml-auto text-slate-500">{bugs.length} bug</span>
          </form>

          {bugs.length === 0 ? (
            <StatePanel
              kind={filtered ? "filtered" : "empty"}
              title={filtered ? "Tidak ada bug yang cocok" : view === "review" ? "Antrean bersih" : "Belum ada bug"}
              action={filtered ? { label: "Hapus semua filter", href: href(view) } : view === "review" ? { label: "Tugas saya", href: href("mine") } : canCreate ? { label: "Laporkan bug", href: `/projects/${project.key}/bugs/new` } : undefined}
            >
              {empty}
            </StatePanel>
          ) : (
            <div className="flex flex-wrap items-start gap-5">
            <div className="flex-[999_1_520px] min-w-0">
              {/* Desktop: dense table. Left strip = severity, readable at a glance. */}
              <table className="hidden md:table w-full text-left text-sm bg-surface border border-slate-200 rounded overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th scope="col" className="w-[3px] p-0"><span className="sr-only">Severity</span></th>
                    <th scope="col" className="py-2 px-3 w-28 font-bold">ID</th>
                    <th scope="col" className="py-2 px-3 font-bold">Judul</th>
                    <th scope="col" className="py-2 px-3 w-24 font-bold">Severity</th>
                    <th scope="col" className="py-2 px-3 w-40 font-bold">Status</th>
                    <th scope="col" className="py-2 px-3 w-40 font-bold">Assignee</th>
                    <th scope="col" className="py-2 px-3 w-28 font-bold text-right" title="Target SLA / Batas waktu penyelesaian">SLA / Sisa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bugs.map((b) => (
                    <tr key={b.id} aria-selected={selected?.id === b.id} className={`row-interactive hover:bg-slate-50/80 ${selected?.id === b.id ? "bg-action-soft" : ""}`}>
                      <td className={`p-0 ${SEVERITY_STYLE[b.severity].strip} strip-accent`} />
                      <td className="py-2 px-3 font-bold whitespace-nowrap">
                        <Link href={bugHref(b.number)} className="text-action hover:underline">{b.key}</Link>
                      </td>
                      <td className="py-2 px-3">
                        <Link href={selHref(b.key)} scroll={false} className="text-slate-900 hover:underline">{b.title}</Link>
                        <span className="block text-xs text-slate-500">
                          {[b.module?.name ?? (b.status === "DRAFT" ? "Modul belum diisi" : null), source(b) && `dari ${source(b)}`, b._count.comments > 0 && `${b._count.comments} komentar`]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </td>
                      <td className="py-2 px-3"><SeverityBadge severity={b.severity} /></td>
                      <td className="py-2 px-3"><StatusBadge status={b.status} /></td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[10rem]">{b.assignee?.name || b.assignee?.email || "Belum di-assign"}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <SlaBadge severity={b.severity} status={b.status} createdAt={b.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile: two-line cards for vendors checking their queue. */}
              <ul className="md:hidden space-y-2">
                {bugs.map((b) => (
                  <li key={b.id}>
                    <Link href={bugHref(b.number)} className="press-snappy flex bg-surface border border-slate-200 hover:border-slate-300 rounded overflow-hidden shadow-xs">
                      <span className={`w-[3px] shrink-0 ${SEVERITY_STYLE[b.severity].strip}`} aria-hidden />
                      <span className="p-3 min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-action text-sm">{b.key}</span>
                          <SeverityBadge severity={b.severity} />
                          <StatusBadge status={b.status} />
                          <span className="ml-auto shrink-0"><SlaBadge severity={b.severity} status={b.status} createdAt={b.createdAt} compact /></span>
                        </span>
                        <span className="block text-sm text-slate-900">{b.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {canReview && (
                <p className="hidden md:block mt-3 text-xs text-slate-500">
                  <kbd className="px-1 border rounded">J</kbd>/<kbd className="px-1 border rounded">K</kbd> pilih · <kbd className="px-1 border rounded">A</kbd> terima · <kbd className="px-1 border rounded">X</kbd> tolak · <kbd className="px-1 border rounded">↵</kbd> buka detail
                </p>
              )}
            </div>
            {selected && (
              <aside aria-label={`Pratinjau dan triase ${selected.key}`} className="hidden md:flex flex-[1_1_340px] max-w-[440px] min-w-0 flex-col bg-surface border border-slate-200 rounded">
                <div className="p-4 border-b border-slate-100 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-action">{selected.key}</span>
                    <Link href={bugHref(selected.number)} className="text-xs text-action underline">Buka detail</Link>
                  </div>
                  <h2 className="font-bold text-slate-900 text-sm">{selected.title}</h2>
                  <p className="text-xs text-slate-500">{[source(selected) && `Dilaporkan oleh ${source(selected)}`, `${selected._count.comments} komentar`].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="p-4 space-y-3 border-b border-slate-100 text-sm">
                  <div><p className="text-xs font-bold text-sev-blocker">Aktual</p><p className="whitespace-pre-wrap text-slate-800 line-clamp-6">{selected.actualResult}</p></div>
                  <div><p className="text-xs font-bold text-green-700">Diharapkan</p><p className="whitespace-pre-wrap text-slate-800 line-clamp-6">{selected.expectedResult}</p></div>
                </div>
                {canReview && selected.status === "DRAFT" ? (
                  <ActionForm action={handleTriage} className="p-4 space-y-3">
                    <input type="hidden" name="bugId" value={selected.id} />
                    <div className="grid grid-cols-2 gap-3 text-xs font-medium text-slate-700">
                      <label className="space-y-1 block">Severity
                        <select name="severity" defaultValue={selected.severity} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
                          {Object.values(BugSeverity).map((v) => <option key={v} value={v}>{SEVERITY_STYLE[v].label}</option>)}
                        </select></label>
                      <label className="space-y-1 block">Priority
                        <select name="priority" defaultValue={selected.priority} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
                          {Object.values(BugPriority).map((v) => <option key={v} value={v}>{v}</option>)}
                        </select></label>
                      <label className="space-y-1 block">Modul
                        <select name="moduleId" defaultValue={selected.moduleId ?? ""} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
                          <option value="">Pilih modul</option>
                          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select></label>
                      <label className="space-y-1 block">Assignee
                        <select name="assigneeId" defaultValue={selected.assigneeId ?? ""} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-surface text-sm">
                          <option value="">Belum di-assign</option>
                          {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.name || m.user.email}</option>)}
                        </select></label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button id="triage-accept" type="submit" name="intent" value="accept" className="flex-1 min-w-[120px] px-3 py-2 bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded">Terima</button>
                      <button type="submit" name="intent" value="save" className="px-3 py-2 border border-slate-300 bg-surface hover:bg-slate-100 text-sm font-bold rounded">Simpan</button>
                      <button id="triage-reject" type="submit" name="intent" value="reject" className="px-3 py-2 border border-slate-300 bg-surface hover:bg-slate-100 text-sm font-bold rounded">Tolak</button>
                    </div>
                  </ActionForm>
                ) : (
                  <p className="p-4 text-xs text-slate-500">{canReview ? "Bug ini sudah ditriase." : "Triase hanya untuk reviewer."} Buka detail untuk aksi lain.</p>
                )}
              </aside>
            )}
            <TriageKeys
              keys={bugs.map((b) => b.key)}
              selected={selected?.key ?? null}
              basePath={selHref("").replace(/sel=$/, "sel=")}
              detailHref={selected ? bugHref(selected.number) : null}
            />
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
