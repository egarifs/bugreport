"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Download, Copy, X } from "lucide-react";
import { buildShareMessage, type ReleaseSummary, type ShareAudience } from "@/lib/report-share";

type PdfState = { status: "idle" | "loading" | "ready" | "error"; file?: File };

function filenameFrom(res: Response, fallback: string) {
  const m = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "");
  return m?.[1] ?? fallback;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ShareReportButton({
  projectKey,
  summary,
  canInternal,
}: {
  projectKey: string;
  summary: ReleaseSummary;
  canInternal: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<ShareAudience>("external");
  const [includeLink, setIncludeLink] = useState(true);
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const [pdf, setPdf] = useState<PdfState>({ status: "idle" });
  const [note, setNote] = useState("");
  const [waFallback, setWaFallback] = useState(false);

  const liveUrl = () =>
    `${window.location.origin}/projects/${projectKey}/reports${summary.version ? `?version=${encodeURIComponent(summary.version)}` : ""}`;

  // Keep the message in sync with the options until the user starts typing their own.
  useEffect(() => {
    if (!open || edited) return;
    setMessage(buildShareMessage(summary, { generatedAt: new Date(), liveUrl: includeLink ? liveUrl() : undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, includeLink, edited, summary]);

  // Fetch the PDF as soon as the dialog opens: mobile browsers only allow navigator.share()
  // right after a tap, so the file must already be in memory when "Bagikan PDF" is pressed.
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setPdf({ status: "loading" });
    const qs = new URLSearchParams({ audience, link: includeLink ? "1" : "0" });
    if (summary.version) qs.set("version", summary.version);
    fetch(`/api/projects/${projectKey}/reports/pdf?${qs}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const file = new File([blob], filenameFrom(res, `${projectKey}-kesiapan-rilis.pdf`), { type: "application/pdf" });
        setPdf({ status: "ready", file });
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setPdf({ status: "error" });
      });
    return () => ctrl.abort();
  }, [open, audience, includeLink, projectKey, summary.version]);

  function openDialog() {
    setNote("");
    setWaFallback(false);
    setEdited(false);
    setOpen(true);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function copyMessage(silent = false) {
    try {
      await navigator.clipboard.writeText(message);
      if (!silent) setNote("Pesan disalin.");
      return true;
    } catch {
      if (!silent) setNote("Tidak bisa menyalin otomatis. Salin pesan dari kotak di atas.");
      return false;
    }
  }

  async function share() {
    const file = pdf.file;
    if (!file) return;
    // Some apps (WhatsApp on Android among them) drop the text when a file is attached,
    // so the message also goes to the clipboard: the user can paste it if it went missing.
    const copied = await copyMessage(true);
    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message, title: file.name });
        setNote(copied ? "Terkirim ke menu berbagi. Pesan juga ada di clipboard bila tidak ikut terkirim." : "Terkirim ke menu berbagi.");
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    // Desktop browsers usually cannot hand a file to WhatsApp: download it and let the user attach it.
    downloadFile(file);
    setWaFallback(true);
    setNote(
      copied
        ? "PDF diunduh dan pesan disalin. Buka WhatsApp, tempel pesan, lalu lampirkan PDF-nya."
        : "PDF diunduh. Buka WhatsApp dan lampirkan PDF-nya."
    );
  }

  const busy = pdf.status === "loading";
  const btnBase = "press-snappy inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold rounded min-h-[44px]";

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={`${btnBase} bg-action hover:bg-action-hover text-white shadow-xs`}
      >
        <Share2 className="w-4 h-4" aria-hidden="true" />
        Bagikan
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-labelledby="share-title"
        className="rounded-lg p-0 w-[min(560px,calc(100vw-2rem))] text-slate-900 shadow-xl backdrop:bg-scrim/40"
      >
        <div className="p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="share-title" className="text-base font-semibold">Bagikan laporan kesiapan rilis</h2>
              <p className="text-sm text-slate-500">PDF A4 untuk WhatsApp, email, atau dicetak.</p>
            </div>
            <button type="button" onClick={closeDialog} aria-label="Tutup" className="p-2.5 -m-1 rounded hover:bg-slate-100">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {canInternal ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold mb-2">Untuk siapa?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["external", "Eksternal", "Klien atau vendor. Status Draft ditulis \"Menunggu review\", data proses internal tidak disertakan."],
                  ["internal", "Internal", "Tim sendiri. Semua data tampil, halaman ditandai Internal."],
                ] as const).map(([value, label, desc]) => (
                  <label
                    key={value}
                    className={`flex gap-3 p-3 rounded border cursor-pointer ${
                      audience === value ? "border-link bg-action-soft" : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="share-audience"
                      value={value}
                      checked={audience === value}
                      onChange={() => setAudience(value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-xs text-slate-600">{desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="text-sm text-slate-600">Versi eksternal: hanya status dan ringkasan bug yang disertakan.</p>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} />
            Sertakan tautan ke laporan live (penerima perlu login)
          </label>

          <div className="space-y-1.5">
            <label htmlFor="share-message" className="text-sm font-semibold">Pesan untuk WhatsApp</label>
            <textarea
              id="share-message"
              rows={6}
              value={message}
              onChange={(e) => {
                setEdited(true);
                setMessage(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded"
            />
            <p className="text-xs text-slate-500">Teks di antara tanda bintang tampil tebal di WhatsApp.</p>
          </div>

          <p role="status" aria-live="polite" className="text-sm text-slate-700 empty:hidden">
            {pdf.status === "error" ? "PDF gagal dibuat. Coba tutup dan buka lagi dialog ini." : note}
            {waFallback && (
              <>
                {" "}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-link underline"
                >
                  Buka WhatsApp
                </a>
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={share}
              disabled={pdf.status !== "ready"}
              className={`${btnBase} bg-action hover:bg-action-hover text-white disabled:opacity-60 disabled:cursor-wait`}
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              {busy ? "Menyiapkan PDF..." : "Bagikan PDF"}
            </button>
            <button
              type="button"
              onClick={() => pdf.file && downloadFile(pdf.file)}
              disabled={pdf.status !== "ready"}
              className={`${btnBase} bg-surface border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-wait`}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Unduh PDF
            </button>
            <button
              type="button"
              onClick={() => copyMessage()}
              className={`${btnBase} text-link hover:bg-slate-50`}
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
              Salin pesan
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
