"use client";

/** Simpan sebagai PDF lewat dialog cetak peramban (fitur bawaan; tanpa pustaka PDF). Tombol ini sendiri tidak ikut tercetak. */
export function PrintButton({ label = "Cetak / simpan PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="print:hidden px-3 min-h-[44px] rounded text-sm font-bold border border-slate-300 bg-surface hover:bg-slate-50">
      {label}
    </button>
  );
}
