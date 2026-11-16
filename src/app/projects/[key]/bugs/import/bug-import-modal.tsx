"use client";

import { useState, useTransition } from "react";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";

export type ImportPreview =
  | { error: string }
  | { rows: { title: string; severity: string; module: string; status: "Siap" | "Mirip"; note: string }[] };

const TEMPLATE =
  "| Judul | Modul | Severity | Langkah | Aktual | Ekspektasi |\n| --- | --- | --- | --- | --- | --- |\n| Checkout crash | Checkout | High | Klik bayar | Err 500 | Sukses |\n";

export function BugImportModal({
  importAction,
  previewAction,
  projectKey,
}: {
  importAction: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  projectKey: string;
  previewAction: (prev: ImportPreview | null, formData: FormData) => Promise<ImportPreview>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
  };
  const rows = preview && "rows" in preview ? preview.rows : null;
  const templateHref = `data:text/markdown;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press-snappy shrink-0 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded bg-surface min-h-[44px]"
      >
        Impor Bug (.md)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-scrim/60 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="import-title" className="bg-surface rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 id="import-title" className="text-base font-bold text-slate-900">Impor bug dari Markdown</h2>
                <p className="text-xs text-slate-500">
                  {rows ? "Langkah 2 dari 2 · Periksa sebelum impor" : "Langkah 1 dari 2 · Pilih file"}
                </p>
              </div>
              <button type="button" onClick={close} aria-label="Tutup" className="text-slate-500 hover:text-slate-900 font-bold min-h-[44px] min-w-[44px]">
                ✕
              </button>
            </div>

            <div className="mt-4">
              <ActionForm
                action={async (prev, fd) => {
                  if (file) fd.set("file", file);
                  const res = await importAction(prev, fd);
                  if (res?.ok) close();
                  return res;
                }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    name="file"
                    aria-label="File Markdown (.md)"
                    accept=".md,.markdown"
                    required={!file}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      setPreview(null);
                      if (!f) return;
                      const fd = new FormData();
                      fd.set("file", f);
                      fd.set("projectKey", projectKey);
                      start(async () => setPreview(await previewAction(null, fd)));
                    }}
                    className="text-xs file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 cursor-pointer"
                  />
                  <a href={templateHref} download="template-bug.md" className="text-xs text-link underline">
                    Unduh template
                  </a>
                </div>

                {pending && <p className="text-xs text-slate-500">Membaca file…</p>}
                {preview && "error" in preview && <p className="text-sm text-sev-blocker font-bold">{preview.error}</p>}

                {rows && (
                  <>
                    <p className="text-xs text-slate-600">
                      <b>{file?.name}</b> · {rows.length} bug terbaca
                    </p>
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-left text-slate-600">
                          <tr>
                            <th className="p-2">Status</th>
                            <th className="p-2">Judul</th>
                            <th className="p-2">Severity</th>
                            <th className="p-2">Modul</th>
                            <th className="p-2">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rows.map((r, i) => (
                            <tr key={i}>
                              <td className="p-2">
                                <span className={`px-1.5 rounded font-bold ${r.status === "Siap" ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>{r.status}</span>
                              </td>
                              <td className="p-2 text-slate-900">{r.title}</td>
                              <td className="p-2">{r.severity}</td>
                              <td className="p-2">{r.module}</td>
                              <td className="p-2 text-slate-500">{r.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-500">Baris Mirip tetap diimpor. Bug masuk sebagai <b>Draft</b> dan menunggu triase QA.</p>
                  </>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button type="button" onClick={close} className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900 rounded font-bold min-h-[44px]">
                    Batal
                  </button>
                  {rows && (
                    <SubmitButton pendingText="Mengimpor..." className="press-snappy px-4 py-2 bg-action hover:bg-action-hover text-on-action text-xs font-bold rounded min-h-[44px]">
                      Impor {rows.length} bug
                    </SubmitButton>
                  )}
                </div>
              </ActionForm>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
