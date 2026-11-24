"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TOUR_STEPS } from "@/lib/onboarding";

type Rect = { top: number; left: number; width: number; height: number };

/** Tur sorotan: menyorot elemen nyata, fokus pindah ke tooltip, Esc menutup, Tab berputar di dalam tooltip. */
export function GuidedTour({ projectKey, tourId, dismiss }: { projectKey: string; tourId: string; dismiss: (id: string) => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [steps, setSteps] = useState<typeof TOUR_STEPS[number][]>([]);
  const box = useRef<HTMLDivElement>(null);
  const onPage = pathname === `/projects/${projectKey}`;

  // Langkah yang elemennya ada di halaman.
  useEffect(() => {
    if (!onPage) return;
    const t = setTimeout(() => setSteps(TOUR_STEPS.filter((s) => document.querySelector(s.selector))), 300);
    return () => clearTimeout(t);
  }, [onPage]);

  const step = steps[i];
  const measure = useCallback(() => {
    const el = step && document.querySelector(step.selector);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return setRect(null); // belum tertata (mis. transisi halaman masih jalan)
    setRect((o) => (o && o.top === r.top && o.left === r.left && o.width === r.width && o.height === r.height ? o : { top: r.top, left: r.left, width: r.width, height: r.height }));
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    document.querySelector(step.selector)?.scrollIntoView({ block: "center", behavior: "auto" });
    measure();
    // Transisi halaman bisa masih berjalan saat pertama diukur: ukur ulang sebentar.
    const timers = [100, 300, 600, 1000].map((ms) => setTimeout(measure, ms));
    // Ukur ulang saat elemen berubah ukuran (mis. baru tertata setelah tab/panel tampil).
    const target = document.querySelector(step.selector);
    const ro = typeof ResizeObserver !== "undefined" && target ? new ResizeObserver(measure) : null;
    if (target) ro?.observe(target);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { ro?.disconnect(); timers.forEach(clearTimeout); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [step, measure]);

  // Tooltip baru terpasang setelah elemen terukur: pindahkan fokus saat itu (sekali per langkah).
  const ready = rect !== null;
  useEffect(() => { if (ready) box.current?.focus(); }, [ready, i]);

  const close = useCallback(() => { setOpen(false); void dismiss(tourId); }, [dismiss, tourId]);

  if (!onPage || !open || !step || !rect) return null;
  const last = i === steps.length - 1;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") {
      const f = box.current?.querySelectorAll<HTMLElement>("button");
      if (!f?.length) return;
      const first = f[0], end = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    }
  };
  const below = rect.top + rect.height + 190 < window.innerHeight;
  return (
    <>
      <div aria-hidden="true" className="fixed pointer-events-none rounded-md ring-2 ring-offset-2 ring-ink z-40" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} />
      <div
        ref={box} tabIndex={-1} role="dialog" aria-label={`Tur: ${step.title}`} onKeyDown={onKey}
        className="fixed z-50 w-72 max-w-[calc(100vw-16px)] bg-surface border border-slate-300 rounded-lg shadow-lg p-4 space-y-2 focus:outline-none"
        style={{ top: below ? rect.top + rect.height + 12 : Math.max(8, rect.top - 170), left: Math.min(Math.max(8, rect.left), window.innerWidth - 296) }}
      >
        <p className="text-xs text-slate-500">Langkah {i + 1} dari {steps.length}</p>
        <h2 className="text-sm font-bold text-slate-900">{step.title}</h2>
        <p className="text-sm text-slate-700">{step.text}</p>
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={close} className="text-xs underline min-h-[44px] px-1">Lewati</button>
          <span className="flex-1" />
          {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="px-3 min-h-[44px] rounded text-sm font-bold border border-slate-300 bg-surface hover:bg-slate-50">Kembali</button>}
          <button type="button" onClick={() => (last ? close() : setI(i + 1))} className="px-3 min-h-[44px] rounded text-sm font-bold bg-ink text-on-ink hover:bg-ink-hover">{last ? "Selesai" : "Lanjut"}</button>
        </div>
      </div>
    </>
  );
}
