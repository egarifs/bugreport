"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterCategory = { param: string; label: string; options: { value: string; label: string }[] };

const csv = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

// One "Filter" button: categories on the left, searchable checkboxes on the right. Every change is written to the URL.
export function FilterMenu({ categories, meId }: { categories: FilterCategory[]; meId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(categories[0]?.param ?? "");
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const selected = (param: string) => csv(sp.get(param));
  const total = categories.reduce((n, c) => n + selected(c.param).length, 0);

  function write(changes: Record<string, string[] | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, vals] of Object.entries(changes)) {
      if (vals && vals.length) p.set(k, vals.join(","));
      else p.delete(k);
    }
    p.delete("page");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const toggle = (param: string, value: string) => {
    const cur = selected(param);
    write({ [param]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };

  const cat = categories.find((c) => c.param === active) ?? categories[0];
  const options = useMemo(
    () => cat?.options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase())) ?? [],
    [cat, search],
  );
  const chips = categories.flatMap((c) =>
    selected(c.param).map((v) => ({ param: c.param, value: v, text: `${c.label}: ${c.options.find((o) => o.value === v)?.label ?? v}` })),
  );
  const unassigned = selected("assignee").length === 1 && selected("assignee")[0] === "none";
  const mine = selected("assignee").length === 1 && selected("assignee")[0] === meId;

  const quick = "w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50";
  return (
    <div ref={root} className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-md bg-surface text-slate-700 text-xs font-semibold hover:bg-slate-50"
      >
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7"/><circle cx="10.5" cy="4.5" r="1.5"/><circle cx="5.5" cy="11.5" r="1.5"/></svg>
        Filter
        {total > 0 && <span className="px-1.5 rounded-full bg-action text-on-action text-[10px] font-mono">{total}</span>}
      </button>

      {chips.map((c) => (
        <button
          key={`${c.param}:${c.value}`}
          type="button"
          onClick={() => toggle(c.param, c.value)}
          aria-label={`Hapus filter ${c.text}`}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] text-slate-700 hover:bg-slate-100"
        >
          {c.text} <span aria-hidden>×</span>
        </button>
      ))}
      {total > 0 && (
        <button type="button" onClick={() => write(Object.fromEntries(categories.map((c) => [c.param, null])))} className="text-xs text-slate-500 underline hover:text-slate-900">
          Reset
        </button>
      )}

      {open && cat && (
        <div role="dialog" aria-label="Filter bug" className="absolute left-0 top-full mt-2 z-30 flex w-[min(560px,92vw)] bg-surface border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <ul className="w-48 shrink-0 border-r border-slate-200 py-1 max-h-[420px] overflow-y-auto">
            {categories.map((c) => {
              const n = selected(c.param).length;
              return (
                <li key={c.param}>
                  <button
                    type="button"
                    aria-current={c.param === cat.param ? "true" : undefined}
                    onClick={() => { setActive(c.param); setSearch(""); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm ${c.param === cat.param ? "bg-action-soft text-action font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span>{c.label}{n > 0 && <span className="ml-1.5 text-[10px] font-mono text-slate-500">({n})</span>}</span>
                    <span aria-hidden className="text-slate-400">›</span>
                  </button>
                </li>
              );
            })}
            <li className="border-t border-slate-100 mt-1 pt-1">
              <button type="button" className={`${quick} ${unassigned ? "font-semibold text-action" : ""}`} onClick={() => write({ assignee: unassigned ? null : ["none"] })}>Belum di-assign</button>
            </li>
            <li>
              <button type="button" className={`${quick} ${mine ? "font-semibold text-action" : ""}`} onClick={() => write({ assignee: mine ? null : [meId] })}>Ditugaskan ke saya</button>
            </li>
          </ul>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <label className="sr-only" htmlFor="filter-search">Cari {cat.label}</label>
              <input
                id="filter-search"
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Cari ${cat.label.toLowerCase()}`}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-action"
              />
            </div>
            <ul className="p-1 max-h-[360px] overflow-y-auto" role="group" aria-label={cat.label}>
              {options.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">Tidak ada pilihan.</li>}
              {options.map((o) => (
                <li key={o.value}>
                  <label className="flex items-center gap-3 px-3 py-2 text-sm text-slate-800 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" checked={selected(cat.param).includes(o.value)} onChange={() => toggle(cat.param, o.value)} />
                    <span className="truncate">{o.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
