"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface MergeModalProps {
  projectKey: string;
  sourceBug: {
    id: string;
    key: string;
    title: string;
    reporterName: string;
    publicCommentsCount: number;
    attachmentsCount: number;
    hasSteps: boolean;
  };
  onMergeAction: (formData: FormData) => Promise<{ error?: string; success?: boolean; targetKey?: string }>;
}

export function MergeDuplicateModal({ projectKey, sourceBug, onMergeAction }: MergeModalProps) {
  const [open, setOpen] = useState(false);
  const [targetKey, setTargetKey] = useState("");
  const [moveComments, setMoveComments] = useState(true);
  const [moveAttachments, setMoveAttachments] = useState(true);
  const [addCoReporter, setAddCoReporter] = useState(true);
  const [copySteps, setCopySteps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!targetKey.trim()) {
      setError("Masukkan kode bug utama tujuan (misal: CRM-6).");
      return;
    }

    const fd = new FormData();
    fd.set("targetKey", targetKey.trim());
    fd.set("movePublicComments", moveComments ? "true" : "false");
    fd.set("moveAttachments", moveAttachments ? "true" : "false");
    fd.set("addCoReporter", addCoReporter ? "true" : "false");
    fd.set("copyStepsAsComment", copySteps ? "true" : "false");

    startTransition(async () => {
      const res = await onMergeAction(fd);
      if (res?.error) {
        setError(res.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-warn-bg hover:bg-warn-bg border border-warn-border rounded flex items-center gap-1.5 transition-colors"
        title="Tandai bug ini sebagai duplikat dan gabungkan ke bug utama"
      >
        <span aria-hidden="true" className="text-amber-600 font-mono font-bold">≡</span>
        Tandai duplikat &amp; gabungkan
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="merge-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg bg-surface rounded-lg shadow-xl border border-slate-200 overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div>
                <h2 id="merge-dialog-title" className="text-base font-bold text-slate-900">
                  Tandai duplikat dan gabungkan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  <code className="font-mono font-bold text-slate-800">{sourceBug.key}</code> akan digabung ke bug utama.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded text-sm"
                aria-label="Tutup dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div role="alert" className="p-2.5 text-xs text-bad bg-bad-bg border border-bad-border rounded">
                  {error}
                </div>
              )}

              {/* Source -> Target Comparison */}
              <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center bg-slate-50 p-3 rounded border border-slate-200">
                <div className="p-2 bg-surface rounded border border-slate-200 text-xs">
                  <div className="font-mono font-bold text-slate-700">{sourceBug.key}</div>
                  <div className="font-semibold text-slate-900 truncate" title={sourceBug.title}>
                    {sourceBug.title}
                  </div>
                  <div className="text-slate-400 text-[11px] truncate">{sourceBug.reporterName}</div>
                </div>

                <span className="text-slate-400 font-bold px-1" aria-hidden="true">→</span>

                <div className="p-2 bg-action-soft/60 rounded border border-action/30 text-xs">
                  <label htmlFor="target-bug-input" className="block text-[11px] font-bold text-link">
                    Bug Utama (Target)
                  </label>
                  <input
                    id="target-bug-input"
                    type="text"
                    value={targetKey}
                    onChange={(e) => setTargetKey(e.target.value.toUpperCase())}
                    placeholder={`mis. ${projectKey}-6`}
                    required
                    className="mt-1 w-full px-2 py-1 text-xs font-mono font-bold border border-action/30 rounded bg-surface text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 text-xs text-slate-700 border-t border-slate-100 pt-3">
                <span className="font-bold text-slate-900 block mb-1">Yang dipindah ke bug utama:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moveComments}
                    onChange={(e) => setMoveComments(e.target.checked)}
                    className="rounded border-slate-300 text-link focus:ring-blue-500"
                  />
                  <span>
                    {sourceBug.publicCommentsCount} komentar publik
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moveAttachments}
                    onChange={(e) => setMoveAttachments(e.target.checked)}
                    className="rounded border-slate-300 text-link focus:ring-blue-500"
                  />
                  <span>
                    {sourceBug.attachmentsCount} bukti / lampiran
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addCoReporter}
                    onChange={(e) => setAddCoReporter(e.target.checked)}
                    className="rounded border-slate-300 text-link focus:ring-blue-500"
                  />
                  <span>
                    {sourceBug.reporterName} ditambahkan sebagai pelapor (Co-Reporter)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copySteps}
                    onChange={(e) => setCopySteps(e.target.checked)}
                    disabled={!sourceBug.hasSteps}
                    className="rounded border-slate-300 text-link focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className={!sourceBug.hasSteps ? "text-slate-400" : ""}>
                    Langkah reproduksi {sourceBug.key} ditambahkan sebagai komentar
                  </span>
                </label>
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                {sourceBug.key} akan berstatus <b>Duplikat</b>. Bisa dibatalkan dalam <b>10 menit</b> dan tercatat di audit log.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded transition-colors shadow-sm"
                >
                  {isPending ? "Menggabungkan..." : "Gabungkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
