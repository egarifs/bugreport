import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission, requireProjectPermission } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";
import { AppShell } from "@/components/layout/app-shell";
import { Markdown, headingId } from "@/components/ui/markdown";
import { isMarkdown, readDocText } from "@/lib/business-docs";
import { diffDocs } from "@/lib/doc-diff";

async function decide(projectId: string, versionId: string, kind: "approve" | "reject", _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  "use server";
  const actor = await requireProjectPermission(projectId, "doc.approve");
  const v = await prisma.businessDocVersion.findUnique({ where: { id: versionId }, include: { doc: { select: { projectId: true, slug: true, project: { select: { key: true } } } } } });
  if (!v || v.doc.projectId !== projectId || v.status !== "PENDING") return { error: "Revisi sudah diputuskan atau tidak ditemukan." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (kind === "reject" && !reason) return { error: "Isi alasan penolakan dulu." };
  await prisma.$transaction([
    ...(kind === "approve" ? [prisma.businessDocVersion.updateMany({ where: { docId: v.docId }, data: { isCurrent: false } })] : []),
    prisma.businessDocVersion.update({
      where: { id: v.id },
      data: kind === "approve"
        ? { status: "APPROVED", isCurrent: true, decidedById: actor.id, decidedAt: new Date() }
        : { status: "REJECTED", rejectReason: reason, decidedById: actor.id, decidedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        projectId,
        actorId: actor.id,
        actorEmail: actor.email,
        action: kind === "approve" ? "doc.approve" : "doc.reject",
        entityType: "doc_version",
        entityId: v.id,
        changes: { after: { docSlug: v.doc.slug, version: v.versionNum, ...(kind === "reject" ? { reason } : {}) } },
      },
    }),
  ]);
  revalidatePath(`/projects/${v.doc.project.key}/docs`);
  revalidatePath(`/projects/${v.doc.project.key}/docs/${v.doc.slug}`);
  return { ok: kind === "approve" ? "Revisi disetujui." : "Revisi ditolak." };
}

export default async function DocViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; slug: string }>;
  searchParams: Promise<{ v?: string; diff?: string }>;
}) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const { key, slug } = await params;
  const { v, diff } = await searchParams;

  const doc = await prisma.businessDoc.findFirst({
    where: { slug, project: { key: key.toUpperCase() } },
    include: { project: { select: { key: true, name: true } }, versions: { orderBy: { versionNum: "desc" } } },
  });
  if (!doc) notFound();
  let actor;
  try {
    actor = await checkProjectPermission(userId, doc.projectId, "doc.read");
  } catch {
    redirect("/projects");
  }
  const canManage = hasPermission(actor.role, "doc.manage", actor.isAdmin);
  const canApprove = hasPermission(actor.role, "doc.approve", actor.isAdmin);
  if (!canManage) doc.versions = doc.versions.filter((x) => x.status === "APPROVED");

  const current = doc.versions.find((x) => x.isCurrent) ?? doc.versions[0];
  const ver = doc.versions.find((x) => String(x.versionNum) === v) ?? current;
  if (!ver) notFound();
  const pkey = doc.project.key;
  const fileUrl = `/api/projects/${pkey}/docs/${ver.id}`;
  const md = isMarkdown(ver.fileName) ? await readDocText(pkey, ver) : null;
  // Pembanding = versi berlaku (atau versi sebelumnya bila ver sendiri yang berlaku).
  const base = ver.isCurrent ? doc.versions.find((x) => x.versionNum < ver.versionNum && x.status === "APPROVED") : current;
  const baseMd = md !== null && base && base.id !== ver.id && isMarkdown(base.fileName) ? await readDocText(pkey, base) : null;
  const diffs = diff === "1" && md !== null && baseMd !== null ? diffDocs(baseMd, md).filter((s) => s.kind !== "same") : null;
  const toc = md
    ? [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].replace(/[*_`]/g, "").trim() }))
    : [];

  return (
    <AppShell activeProjectKey={pkey}>
      <div className="min-h-full flex flex-col">
        <header className="bg-surface border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <nav className="flex items-center gap-2 text-sm min-w-0">
            <Link href={`/projects/${pkey}/docs`} className="text-slate-600 hover:text-slate-900">← Dokumen bisnis</Link>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <h1 className="font-bold text-slate-900 truncate">{doc.title}</h1>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-slate-500">Versi</span>
            {doc.versions.map((x) => (
              <Link
                key={x.id}
                href={`?v=${x.versionNum}`}
                aria-current={x.id === ver.id ? "page" : undefined}
                className={`px-2 py-0.5 rounded border font-mono text-xs ${
                  x.id === ver.id ? "bg-ink text-on-ink border-slate-900" : "border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                v{x.versionNum}
              </Link>
            ))}
            <a href={`${fileUrl}?download=1`} className="ml-2 px-3 py-1.5 border border-slate-300 rounded font-medium text-slate-700 hover:bg-slate-50">
              Unduh
            </a>
          </div>
        </header>

        {ver.status !== "APPROVED" && (
          <div role="note" className="px-6 py-3 bg-warn-bg border-b border-warn-border text-sm text-warn space-y-2">
            <p>
              <b>v{ver.versionNum} {ver.status === "PENDING" ? "menunggu persetujuan" : "ditolak"}.</b> Belum dipakai sebagai acuan QA maupun AI chat.
              {ver.changeNote && <> Catatan: {ver.changeNote}</>}
              {ver.rejectReason && <> Alasan penolakan: {ver.rejectReason}</>}
            </p>
            {ver.status === "PENDING" && canApprove && (
              <div className="flex flex-wrap gap-3 items-start">
                <ActionForm action={decide.bind(null, doc.projectId, ver.id, "approve")}>
                  <SubmitButton pendingText="Menyetujui...">Setujui jadi versi berlaku</SubmitButton>
                </ActionForm>
                <ActionForm action={decide.bind(null, doc.projectId, ver.id, "reject")} className="flex gap-2">
                  <input name="reason" required placeholder="Alasan penolakan" aria-label="Alasan penolakan" className="px-2 py-1 border border-slate-300 rounded text-xs bg-surface" />
                  <SubmitButton pendingText="Menolak...">Tolak</SubmitButton>
                </ActionForm>
              </div>
            )}
          </div>
        )}
        {ver.status === "APPROVED" && !ver.isCurrent && (
          <p role="note" className="px-6 py-2 bg-warn-bg border-b border-warn-border text-sm text-warn">
            Anda melihat v{ver.versionNum} (lama). Versi aktif:{" "}
            <Link href="?" className="font-bold underline">v{current.versionNum}</Link>.
          </p>
        )}

        <div className="px-6 py-2 text-xs text-slate-500 border-b border-slate-200 bg-surface">
          {ver.fileName} · {(ver.fileSize / 1024).toFixed(1)} KB · diunggah {ver.uploadedAt.toLocaleDateString("id-ID", { dateStyle: "medium" })}
          {doc.description && <> · {doc.description}</>}
        </div>

        {baseMd !== null && base && (
          <div className="px-6 py-2 border-b border-slate-200 bg-surface text-sm flex items-center gap-3">
            <Link href={diffs ? "?" + new URLSearchParams({ v: String(ver.versionNum) }) : "?" + new URLSearchParams({ v: String(ver.versionNum), diff: "1" })} className="font-bold text-link hover:underline">
              {diffs ? "Kembali ke isi dokumen" : `Lihat perbedaan dengan v${base.versionNum}`}
            </Link>
          </div>
        )}

        {diffs ? (
          <section aria-label={`Perbedaan v${base!.versionNum} ke v${ver.versionNum}`} className="p-6 max-w-4xl space-y-4">
            {diffs.length === 0 && <p className="text-sm text-slate-600">Tidak ada perbedaan isi.</p>}
            {diffs.map((s) => (
              <div key={s.heading} className="bg-surface border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                  <b className="text-sm">{s.heading}</b>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${s.kind === "added" ? "bg-ok-bg text-ok" : s.kind === "removed" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn"}`}>
                    {s.kind === "added" ? "Ditambah" : s.kind === "removed" ? "Dihapus" : "Diubah"}
                  </span>
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap p-0 m-0">
                  {s.lines.filter((l) => l.op !== " " || s.kind === "changed").map((l, i) => (
                    <div key={i} className={`px-4 py-0.5 ${l.op === "+" ? "bg-ok-bg text-ok" : l.op === "-" ? "bg-bad-bg text-bad" : "text-slate-500"}`}>
                      <span aria-hidden="true" className="select-none mr-2">{l.op}</span>
                      <span className="sr-only">{l.op === "+" ? "Ditambah: " : l.op === "-" ? "Dihapus: " : ""}</span>{l.text}
                    </div>
                  ))}
                </pre>
              </div>
            ))}
          </section>
        ) : md !== null ? (
          <div className="flex-1 flex gap-8 p-6">
            {toc.length > 2 && (
              <nav aria-label="Daftar isi" className="hidden lg:block w-64 shrink-0">
                <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto text-sm">
                  <p className="font-bold text-slate-900 mb-2">Daftar isi</p>
                  <ul className="space-y-1 border-l border-slate-200">
                    {toc.map((t, i) => (
                      <li key={i}>
                        <a href={`#${headingId(t.text)}`} className={`block -ml-px border-l border-transparent hover:border-slate-900 text-slate-600 hover:text-slate-900 ${t.level === 3 ? "pl-6" : "pl-3"}`}>
                          {t.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>
            )}
            <article className="self-start flex-1 min-w-0 max-w-4xl bg-surface border border-slate-200 rounded-lg p-6 md:p-10">
              <Markdown anchors>{md}</Markdown>
            </article>
          </div>
        ) : isMarkdown(ver.fileName) ? (
          <p className="m-6 p-6 bg-surface border border-slate-200 rounded-lg text-sm text-slate-600">File tidak ditemukan di server. Unggah ulang dokumen ini.</p>
        ) : (
          <iframe src={fileUrl} title={`${doc.title} v${ver.versionNum}`} className="flex-1 w-full min-h-[80vh] bg-slate-100" />
        )}
      </div>
    </AppShell>
  );
}
