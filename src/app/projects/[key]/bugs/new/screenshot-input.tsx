"use client";

import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_COUNT = 5;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

// Native file input as the source of truth (server reads formData "screenshots").
// Adds drop + paste (Ctrl+V after Win+Shift+S / Cmd+Shift+4) and previews. Server re-validates everything.
export function ScreenshotInput() {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach(URL.revokeObjectURL);
  }, [files]);

  function apply(next: File[]) {
    const msgs: string[] = [];
    let ok = next.filter((f) => {
      if (!ACCEPT.split(",").includes(f.type)) return msgs.push(`${f.name}: bukan PNG/JPG/WEBP/GIF`), false;
      if (f.size > MAX_BYTES) return msgs.push(`${f.name}: ${(f.size / 1048576).toFixed(1)} MB, maks 5 MB`), false;
      return true;
    });
    if (ok.length > MAX_COUNT) {
      msgs.push(`Maksimal ${MAX_COUNT} screenshot`);
      ok = ok.slice(0, MAX_COUNT);
    }
    const dt = new DataTransfer();
    ok.forEach((f) => dt.items.add(f));
    input.current!.files = dt.files;
    setFiles(ok);
    setError(msgs.join(". "));
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const pasted = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (!pasted.length) return;
      e.preventDefault();
      apply([...files, ...pasted.map((f, i) => new File([f], `paste-${Date.now()}-${i}.png`, { type: f.type }))]);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  return (
    <div>
      <label
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          apply([...files, ...e.dataTransfer.files]);
        }}
        className={`flex flex-col items-center justify-center gap-1 px-4 py-6 border-2 border-dashed rounded cursor-pointer text-center focus-within:ring-2 focus-within:ring-action ${
          over ? "border-action bg-slate-100" : "border-slate-300 hover:bg-slate-50"
        }`}
      >
        <span className="font-bold text-slate-800">Tarik gambar ke sini, tempel (Ctrl+V), atau klik untuk memilih</span>
        <span className="text-xs text-slate-500">PNG, JPG, WEBP, GIF. Maks {MAX_COUNT} file, masing-masing 5 MB.</span>
        <input
          ref={input}
          type="file"
          name="screenshots"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => apply([...files, ...(e.target.files ?? [])].filter((f, i, a) => a.indexOf(f) === i))}
        />
      </label>
      {error && <p role="alert" className="mt-2 text-xs font-bold text-sev-blocker">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {files.map((f, i) => (
            <li key={urls[i] ?? i} className="relative border border-slate-200 rounded overflow-hidden bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: preview */}
              {urls[i] && <img src={urls[i]} alt={f.name} className="w-full h-24 object-cover" />}
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                <span className="truncate" title={f.name}>{f.name}</span>
                <button
                  type="button"
                  onClick={() => apply(files.filter((_, j) => j !== i))}
                  className="shrink-0 px-1.5 font-bold text-slate-600 hover:text-sev-blocker"
                  aria-label={`Hapus ${f.name}`}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
