import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectPermission } from "@/lib/authz";
import { AppShell } from "@/components/layout/app-shell";
import { Markdown, headingId } from "@/components/ui/markdown";
import { isMarkdown, readDocText } from "@/lib/business-docs";

export default async function DocViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string; slug: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const { key, slug } = await params;
  const { v } = await searchParams;

  const doc = await prisma.businessDoc.findFirst({
    where: { slug, project: { key: key.toUpperCase() } },
    include: { project: { select: { key: true, name: true } }, versions: { orderBy: { versionNum: "desc" } } },
  });
  if (!doc) notFound();
  try {
    await checkProjectPermission(userId, doc.projectId, "doc.read");
  } catch {
    redirect("/projects");
  }

  const current = doc.versions.find((x) => x.isCurrent) ?? doc.versions[0];
  const ver = doc.versions.find((x) => String(x.versionNum) === v) ?? current;
  if (!ver) notFound();
  const pkey = doc.project.key;
  const fileUrl = `/api/projects/${pkey}/docs/${ver.id}`;
  const md = isMarkdown(ver.fileName) ? await readDocText(pkey, ver) : null;
  const toc = md
    ? [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].replace(/[*_`]/g, "").trim() }))
    : [];

  return (
    <AppShell activeProjectKey={pkey}>
      <div className="min-h-full flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
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
                  x.id === ver.id ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-700 hover:bg-slate-100"
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

        {!ver.isCurrent && (
          <p role="note" className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
            Anda melihat v{ver.versionNum} (lama). Versi aktif:{" "}
            <Link href="?" className="font-bold underline">v{current.versionNum}</Link>.
          </p>
        )}

        <div className="px-6 py-2 text-xs text-slate-500 border-b border-slate-200 bg-white">
          {ver.fileName} · {(ver.fileSize / 1024).toFixed(1)} KB · diunggah {ver.uploadedAt.toLocaleDateString("id-ID", { dateStyle: "medium" })}
          {doc.description && <> · {doc.description}</>}
        </div>

        {md !== null ? (
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
            <article className="self-start flex-1 min-w-0 max-w-4xl bg-white border border-slate-200 rounded-lg p-6 md:p-10">
              <Markdown anchors>{md}</Markdown>
            </article>
          </div>
        ) : isMarkdown(ver.fileName) ? (
          <p className="m-6 p-6 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">File tidak ditemukan di server. Unggah ulang dokumen ini.</p>
        ) : (
          <iframe src={fileUrl} title={`${doc.title} v${ver.versionNum}`} className="flex-1 w-full min-h-[80vh] bg-slate-100" />
        )}
      </div>
    </AppShell>
  );
}
