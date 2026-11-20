import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

const labels: Record<string, string> = { PASS: "Lolos", FAIL: "Gagal", BLOCKED: "Terblokir", SKIPPED: "Dilewati" };
const marks: Record<string, string> = { PASS: "✓", FAIL: "×", BLOCKED: "–", SKIPPED: "⊘" };
const colors: Record<string, string> = { PASS: "text-ok", FAIL: "text-bad", BLOCKED: "text-warn", SKIPPED: "text-text-muted" };
const wib = (date: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date);

export default async function AgentSessionPage({ params }: { params: Promise<{ key: string; sessionId: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;
  if (!user?.id) redirect("/login");
  const { key, sessionId } = await params;
  const project = await prisma.project.findUnique({ where: { key: key.toUpperCase() }, include: { members: { where: { userId: user.id } } } });
  if (!project) notFound();
  const role = project.members[0]?.role ?? null;
  if (!role && !user.isAdmin) redirect("/projects");
  if (!hasPermission(role, "testcase.read", user.isAdmin)) redirect(`/projects/${project.key}`);

  const run = await prisma.agentRun.findFirst({
    where: { id: sessionId, projectId: project.id },
    include: {
      testRun: { select: { id: true, name: true } },
      attempts: {
        orderBy: { createdAt: "asc" },
        include: {
          item: { include: { testCase: { select: { code: true, title: true } } } },
          bugLinks: { include: { bug: { select: { key: true, number: true, status: true } } } },
        },
      },
      createdBugs: { select: { key: true, number: true, title: true, status: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) notFound();

  const count = (result: string) => run.attempts.filter((attempt) => attempt.result === result).length;
  const summary = run.summary && typeof run.summary === "object" && !Array.isArray(run.summary) ? run.summary as { total?: number; passed?: number; failed?: number; blocked?: number; skipped?: number; newBugs?: number; linkedBugs?: number } : null;
  const total = summary?.total ?? run.attempts.length;

  return (
    <AppShell activeProjectKey={project.key}>
      <main className="min-h-full bg-surface-base p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div><Link href={run.testRun ? `/projects/${project.key}/test-runs/${run.testRun.id}` : `/projects/${project.key}/settings`} className="text-sm text-link hover:underline">← Kembali</Link><h1 className="mt-2 text-xl font-bold">Sesi agent · {run.agentName}</h1><p className="mt-1 text-sm text-text-muted">{run.toolName || "Tool tidak dicatat"} · {run.workdir || "Folder kerja tidak dicatat"}</p></div>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${run.status === "COMPLETED" ? "bg-ok-bg text-ok" : run.status === "FAILED" ? "bg-bad-bg text-bad" : "bg-action-soft text-action"}`}>{run.status === "COMPLETED" ? "Selesai" : run.status === "FAILED" ? "Gagal" : "Sedang berjalan"}</span>
        </div>
        <section className="rounded-xl border border-border-base bg-surface-raised p-5"><div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted"><span>Mulai {wib(run.startedAt)} WIB</span>{run.finishedAt && <span>Selesai {wib(run.finishedAt)} WIB</span>}{run.testRun && <span>Run: <Link className="text-link hover:underline" href={`/projects/${project.key}/test-runs/${run.testRun.id}`}>{run.testRun.name}</Link></span>}</div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6">{[["total", "Total", total], ["PASS", "Lolos", summary?.passed ?? count("PASS")], ["FAIL", "Gagal", summary?.failed ?? count("FAIL")], ["BLOCKED", "Terblokir", summary?.blocked ?? count("BLOCKED")], ["SKIPPED", "Dilewati", summary?.skipped ?? count("SKIPPED")], ["bugs", "Bug baru", summary?.newBugs ?? run.createdBugs.length]].map(([keyName, label, value]) => <div key={String(keyName)} className="rounded-lg bg-surface-sunken p-3"><div className={`text-xl font-bold ${colors[String(keyName)] || "text-text-base"}`}>{value}</div><div className="text-xs text-text-muted">{label}</div></div>)}</div></section>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="rounded-xl border border-border-base bg-surface-raised p-5"><h2 className="font-bold">Hasil sesi</h2>{run.attempts.length === 0 ? <p className="mt-4 text-sm text-text-muted">Belum ada hasil.</p> : <ol className="mt-3 divide-y divide-border-muted">{run.attempts.map((attempt) => <li key={attempt.id} className="py-3 text-sm"><div className="flex flex-wrap items-center gap-2"><b className={colors[attempt.result]}>{marks[attempt.result]} {labels[attempt.result] || attempt.result}</b><span className="font-mono text-xs text-text-muted">{attempt.item.testCase.code}</span><span className="text-text-muted">{wib(attempt.createdAt)} WIB</span>{attempt.viaAgent && <span className="rounded bg-action-soft px-2 py-0.5 text-xs font-bold text-action">via agent {attempt.toolName || run.agentName}</span>}</div><p className="mt-1 font-medium">{attempt.item.testCase.title}</p><p className="mt-1 text-xs text-text-muted">{[attempt.build, attempt.environment, attempt.notes].filter(Boolean).join(" · ") || "Tidak ada catatan"}</p>{attempt.bugLinks.length > 0 && <p className="mt-1 flex flex-wrap gap-2">{attempt.bugLinks.map((link) => <Link key={link.bug.key} href={`/projects/${project.key}/bugs/${link.bug.number}`} className="font-mono text-xs text-link hover:underline">{link.bug.key}</Link>)}</p>}</li>)}</ol>}</section>
          <aside className="rounded-xl border border-border-base bg-surface-raised p-5"><h2 className="font-bold">Bug dari sesi</h2>{run.createdBugs.length === 0 ? <p className="mt-3 text-sm text-text-muted">Tidak ada bug baru.</p> : <ul className="mt-3 space-y-3">{run.createdBugs.map((bug) => <li key={bug.key}><Link href={`/projects/${project.key}/bugs/${bug.number}`} className="font-mono font-bold text-link hover:underline">{bug.key}</Link><p className="text-sm">{bug.title}</p><span className="text-xs text-text-muted">{bug.status}</span></li>)}</ul>}</aside>
        </div>
      </main>
    </AppShell>
  );
}
