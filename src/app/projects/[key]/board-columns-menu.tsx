"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORE = "bug-board-hide";

// "Kolom" button on the board: tick the columns to show. The URL (?hide=) wins; localStorage only supplies the default.
export function BoardColumnsMenu({ columns, hidden: serverHidden }: { columns: { id: string; label: string }[]; hidden: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // Optimistic: show a click at once and keep chained clicks; drop the pending value only when the URL shows exactly it.
  const [pending, setPending] = useState<string[] | null>(null);
  const serverKey = serverHidden.join(",");
  const hidden = pending ?? serverHidden;
  useEffect(() => { if (pending && serverKey === pending.join(",")) setPending(null); }, [serverKey, pending]);

  function write(next: string[]) {
    setPending(next);
    const p = new URLSearchParams(sp.toString());
    if (next.length) p.set("hide", next.join(","));
    else p.delete("hide");
    try { localStorage.setItem(STORE, next.join(",")); } catch { /* storage blocked: URL still works */ }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE);
      if (!sp.has("hide") && saved) {
        const p = new URLSearchParams(sp.toString());
        p.set("hide", saved);
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      }
    } catch { /* storage blocked */ }
    // run once on mount: later URL changes are the user's own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const visible = columns.length - hidden.length;
  const toggle = (id: string) => write(hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]);
  return (
    <div ref={root} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-md bg-surface text-slate-700 text-xs font-semibold hover:bg-slate-50">
        Kolom <span className="font-mono text-slate-500">{visible}/{columns.length}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Kolom board" className="absolute left-0 top-full mt-2 z-30 w-56 bg-surface border border-slate-200 rounded-lg shadow-lg p-2">
          <ul className="space-y-0.5">
            {columns.map((c) => {
              const shown = !hidden.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex items-center gap-3 px-2 py-1.5 text-sm rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" checked={shown} disabled={shown && visible === 1} onChange={() => toggle(c.id)} />
                    <span>{c.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {hidden.length > 0 && <button type="button" onClick={() => write([])} className="mt-1 w-full text-left px-2 py-1.5 text-xs text-slate-500 underline hover:text-slate-900">Tampilkan semua</button>}
        </div>
      )}
    </div>
  );
}
