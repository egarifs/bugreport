import type { RunCounts, RunKind } from "@/lib/test-run-state";
import { RUN_LABEL } from "@/lib/test-run-state";

const BOX = "shrink-0";

// GitHub Actions style: amber spinner while the run is not green yet, check when it passed, cross when it failed.
export function RunStateIcon({ kind, size = 18 }: { kind: RunKind; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, className: BOX } as const;
  if (kind === "running" || kind === "waiting") {
    // running spins fast, waiting spins slowly (both stop for reduced-motion users and keep the ring visible)
    const speed = kind === "running" ? "animate-spin" : "animate-[spin_2.4s_linear_infinite]";
    return (
      <svg {...common} className={`${BOX} text-amber-500 ${speed} motion-reduce:animate-none`}>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "passed") {
    return (
      <svg {...common} className={`${BOX} text-emerald-600 run-pop`}>
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M4.6 8.4L7 10.8L11.4 5.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "failed") {
    return (
      <svg {...common} className={`${BOX} text-rose-600 run-pop`}>
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M5.6 5.6L10.4 10.4M10.4 5.6L5.6 10.4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common} className={`${BOX} text-slate-400`}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}

const TONE: Record<RunKind, string> = {
  empty: "text-slate-500", running: "text-amber-700", waiting: "text-amber-700", passed: "text-emerald-700", failed: "text-rose-700",
};

export function RunStateBadge({ kind, done, total }: { kind: RunKind; done: number; total: number }) {
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 text-xs font-semibold ${TONE[kind]}`}>
      <RunStateIcon kind={kind} size={16} />
      {RUN_LABEL[kind]}
      {total > 0 && <span className="font-mono font-medium text-slate-500">{done}/{total}</span>}
    </span>
  );
}

// Segments grow in order pass, fail, blocked, skipped; the unfinished rest shows an animated stripe while the run is not done.
export function RunProgressBar({ counts, active }: { counts: RunCounts; active: boolean }) {
  const total = counts.PASS + counts.FAIL + counts.BLOCKED + counts.SKIPPED + counts.NOT_RUN;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const seg = (n: number, cls: string, label: string) => (n > 0 ? <span key={label} title={`${label} ${n}`} className={`h-full ${cls} transition-[width] duration-500`} style={{ width: pct(n) }} /> : null);
  return (
    <div role="img" aria-label={`${total - counts.NOT_RUN} dari ${total} selesai`} className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
      {seg(counts.PASS, "bg-emerald-500", "Lolos")}
      {seg(counts.FAIL, "bg-rose-500", "Gagal")}
      {seg(counts.BLOCKED, "bg-slate-500", "Terblokir")}
      {seg(counts.SKIPPED, "bg-slate-300", "Dilewati")}
      {counts.NOT_RUN > 0 && <span className={`h-full ${active ? "run-stripes" : "bg-slate-200"}`} style={{ width: pct(counts.NOT_RUN) }} />}
    </div>
  );
}
