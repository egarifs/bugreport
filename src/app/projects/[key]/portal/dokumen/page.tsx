import Link from "next/link";
import { prisma } from "@/lib/db";
import { PortalShell, portalContext } from "@/components/layout/portal-shell";

export default async function PortalDokumen({ params }: { params: Promise<{ key: string }> }) {
  const { project, can } = await portalContext((await params).key);
  // Izin doc.read wajib; hanya versi berlaku (disetujui) yang ditampilkan.
  const docs = can("doc.read")
    ? await prisma.businessDoc.findMany({
        where: { projectId: project.id, versions: { some: { isCurrent: true, status: "APPROVED" } } },
        orderBy: { updatedAt: "desc" },
        include: { versions: { where: { isCurrent: true }, select: { versionNum: true, uploadedAt: true } } },
      })
    : [];
  return (
    <PortalShell projectKey={project.key} projectName={project.name} active="/dokumen" canReport={can("bug.create")}>
      <h1 className="text-xl font-bold">Dokumen</h1>
      <ul className="bg-surface border border-slate-200 rounded divide-y divide-slate-100">
        {docs.length === 0 && <li className="p-6 text-center text-xs text-slate-500">Belum ada dokumen.</li>}
        {docs.map((d) => (
          <li key={d.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <Link href={`/projects/${project.key}/docs/${d.slug}`} className="font-bold text-link hover:underline">{d.title}</Link>
              {d.description && <p className="text-xs text-slate-600">{d.description}</p>}
            </div>
            <span className="text-xs text-slate-600 whitespace-nowrap">v{d.versions[0].versionNum} · {d.versions[0].uploadedAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}</span>
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}
