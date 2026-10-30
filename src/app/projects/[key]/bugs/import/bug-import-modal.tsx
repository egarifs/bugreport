"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/ui/action-form";

export function BugImportModal({
  importAction,
}: {
  importAction: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press-snappy shrink-0 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded flex items-center gap-1.5 bg-white"
      >
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span>Impor Bug (.md)</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 chat-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>📥</span> Impor Bug dari Markdown (.md)
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Upload file Markdown (.md) berisi daftar bug. Sistem mendukung format tabel Markdown maupun heading <code>## Bug: [Judul]</code>. Bug akan diimpor sebagai status <strong>Draft</strong> untuk direview QA.
            </p>

            <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] text-slate-600 overflow-x-auto">
              <code>
                | Judul | Modul | Severity | Langkah | Aktual | Ekspektasi |<br />
                | --- | --- | --- | --- | --- | --- |<br />
                | Checkout crash | Checkout | Critical | Klik bayar | Err 500 | Sukses |
              </code>
            </div>

            <div className="mt-4">
              <ActionForm
                action={async (prev, fd) => {
                  const res = await importAction(prev, fd);
                  if (res?.ok) {
                    setOpen(false);
                  }
                  return res;
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilih File Markdown (.md)
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".md,.markdown"
                    required
                    className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded font-medium"
                  >
                    Batal
                  </button>
                  <SubmitButton
                    pendingText="Mengimpor..."
                    className="press-snappy px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded"
                  >
                    Upload & Impor Bug
                  </SubmitButton>
                </div>
              </ActionForm>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
