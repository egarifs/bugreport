import { prisma } from "@/lib/db";
import { PortalShell, portalContext } from "@/components/layout/portal-shell";
import { publishedReleaseNotes } from "@/lib/stlc-service";

const DONE = ["CLOSED", "INVALID", "DUPLICATE", "CANNOT_REPRODUCE", "WONT_FIX"];

export default async function PortalRilis({ params }: { params: Promise<{ key: string }> }) {
  const { project, can } = await portalContext((await params).key);
  // Hanya bug yang dilaporkan anggota CLIENT, sama seperti "Bug kami".
  const clients = await prisma.projectMember.findMany({ where: { projectId: project.id, role: "CLIENT" }, select: { userId: true } });
  const bugs = await prisma.bug.findMany({
    where: { projectId: project.id, reporterId: { in: clients.map((c) => c.userId) } },
    select: { status: true, fixedInVersion: true },
  });
  const open = bugs.filter((b) => !DONE.includes(b.status)).length;
  const byVersion = new Map<string, { fixed: number; verified: number }>();
  for (const b of bugs) {
    if (!b.fixedInVersion) continue;
    const e = byVersion.get(b.fixedInVersion) ?? { fixed: 0, verified: 0 };
    e.fixed++;
    if (b.status === "CLOSED") e.verified++;
    byVersion.set(b.fixedInVersion, e);
  }
  const notes = await publishedReleaseNotes(project.id);
  const rows = [...byVersion.entries()].sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }));

  return (
    <PortalShell projectKey={project.key} projectName={project.name} active="/rilis" canReport={can("bug.create")}>
      <h1 className="text-xl font-bold">Status rilis</h1>
      <p className="text-sm text-slate-700"><b>{open}</b> bug Anda masih aktif.</p>
      <div className="overflow-x-auto bg-surface border border-slate-200 rounded">
        <table className="w-full text-sm">
          <caption className="sr-only">Bug yang diperbaiki per versi</caption>
          <thead className="bg-slate-100 text-left text-xs text-slate-600"><tr><th scope="col" className="p-3">Versi</th><th scope="col" className="p-3">Bug diperbaiki</th><th scope="col" className="p-3">Sudah dites ulang</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-xs text-slate-500">Belum ada perbaikan yang dirilis.</td></tr>}
            {rows.map(([v, e]) => <tr key={v}><td className="p-3 font-mono font-bold">{v}</td><td className="p-3">{e.fixed}</td><td className="p-3">{e.verified} dari {e.fixed}</td></tr>)}
          </tbody>
        </table>
      </div>
      {notes.map((n) => (
        <section key={n.id} aria-label={n.title} className="bg-surface border border-slate-200 rounded p-4 space-y-2">
          <h2 className="text-base font-bold">{n.title}</h2>
          <h3 className="text-sm font-bold">Perbaikan</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">{n.fixes.map((f) => <li key={f.key}>{f.text}</li>)}{!n.fixes.length && <li className="list-none -ml-5 text-slate-500">Tidak ada.</li>}</ul>
          {n.known.length > 0 && (<><h3 className="text-sm font-bold">Masalah yang diketahui</h3><ul className="list-disc pl-5 text-sm space-y-1">{n.known.map((f) => <li key={f.key}>{f.text}</li>)}</ul></>)}
        </section>
      ))}
    </PortalShell>
  );
}
