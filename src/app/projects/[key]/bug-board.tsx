"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BugStatus } from "@prisma/client";
import type { BoardCard, BoardColumnData } from "@/lib/bug-board-service";
import { SEVERITY_STYLE, STATUS_LABEL, SeverityBadge } from "@/components/ui/bug-badges";
import { SlaBadge } from "@/components/ui/sla-badge";
import { moveBugAction } from "./board-actions";

type ColumnView = BoardColumnData & { statuses: BugStatus[]; dropStatus: BugStatus | null; moreHref: string | null };

const initials = (n: string) => n.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export function BugBoard({ projectKey, columns, allowed }: {
  projectKey: string;
  columns: ColumnView[];
  allowed: Record<string, BugStatus[]>; // current status -> statuses this user may drag to
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cards, setCards] = useState<BoardCard[]>(() => columns.flatMap((c) => c.cards));
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: string; ok: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Server data is the source of truth: reset local optimistic state whenever it changes.
  useEffect(() => setCards(columns.flatMap((c) => c.cards)), [columns]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const byId = new Map(cards.map((c) => [c.id, c]));
  const canDrop = (card: BoardCard | undefined, col: ColumnView) =>
    Boolean(card && col.dropStatus && card.status !== col.dropStatus && allowed[card.status]?.includes(col.dropStatus));

  function move(id: string, target: BugStatus) {
    const card = byId.get(id);
    if (!card || card.status === target) return;
    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: target } : c)));
    startTransition(async () => {
      let res: { ok?: string; error?: string };
      try { res = await moveBugAction(projectKey, id, target); } catch { res = { error: "Gagal memindahkan bug." }; }
      if ("error" in res && res.error) { setCards(prev); setToast(res.error); }
      else { setToast(`${card.key}: ${STATUS_LABEL[card.status]} → ${STATUS_LABEL[target]}`); router.refresh(); }
    });
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-3 items-start" role="list" aria-label="Board bug">
        {columns.map((col) => {
          const shown = cards.filter((c) => col.statuses.includes(c.status));
          const serverShown = col.cards.length;
          const count = col.count - serverShown + shown.length;
          const state = over?.col === col.id ? (over.ok ? "ring-2 ring-action ring-offset-1" : "ring-2 ring-bad ring-offset-1") : "";
          return (
            <section
              key={col.id}
              role="listitem"
              aria-label={`${col.label}, ${count} bug`}
              onDragOver={(e) => { if (!dragId) return; e.preventDefault(); setOver({ col: col.id, ok: canDrop(byId.get(dragId), col) }); }}
              onDragLeave={() => setOver((o) => (o?.col === col.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const card = dragId ? byId.get(dragId) : undefined;
                setOver(null); setDragId(null);
                if (!card || !col.dropStatus || card.status === col.dropStatus) return;
                if (canDrop(card, col)) move(card.id, col.dropStatus);
                else setToast(`${card.key} tidak bisa dipindah ke ${col.label} dari sini. Buka detail bug untuk perubahan yang butuh data tambahan.`);
              }}
              className={`flex-[0_0_280px] flex flex-col max-h-[calc(100vh-15rem)] bg-slate-50 border border-slate-200 rounded-lg ${state}`}
            >
              <h2 className="px-3 py-2.5 flex items-center justify-between text-sm font-semibold text-slate-900">
                {col.label}
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface border border-slate-200 text-slate-600">{count}</span>
              </h2>
              <ul className="px-2.5 pb-2.5 space-y-2 overflow-y-auto min-h-[56px]">
                {shown.length === 0 && <li className="px-2 py-3 text-xs text-slate-400">Kosong</li>}
                {shown.map((c) => {
                  const targets = allowed[c.status] ?? [];
                  return (
                    <li
                      key={c.id}
                      draggable={targets.length > 0}
                      onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                      className={`relative bg-surface border border-slate-200 hover:border-slate-300 rounded-md pl-3 pr-2.5 py-2 shadow-2xs overflow-hidden ${targets.length ? "cursor-grab" : ""} ${dragId === c.id ? "opacity-40" : ""}`}
                    >
                      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${SEVERITY_STYLE[c.severity].strip}`} />
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <Link href={`/projects/${projectKey}/bugs/${c.number}`} className="font-mono font-bold text-action hover:underline">{c.key}</Link>
                        <SeverityBadge severity={c.severity} />
                      </div>
                      <p className="mt-1 text-sm text-slate-900 leading-snug line-clamp-3">{c.title}</p>
                      {(c.moduleName || c.sprintName) && (
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {[c.moduleName, c.sprintName].filter(Boolean).map((t) => <span key={t} className="text-[11px] px-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">{t}</span>)}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                        <span title={c.assigneeName ?? "Belum di-assign"} className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold inline-flex items-center justify-center">{c.assigneeName ? initials(c.assigneeName) : "–"}</span>
                        <SlaBadge severity={c.severity} status={c.status} createdAt={c.createdAt} compact />
                        <span className="ml-auto font-mono" aria-label={`${c.comments} komentar, ${c.attachments} lampiran`}>💬 {c.comments} · 📎 {c.attachments}</span>
                      </div>
                      {targets.length > 0 && (
                        <select
                          aria-label={`Pindahkan ${c.key} ke`}
                          value=""
                          onChange={(e) => move(c.id, e.target.value as BugStatus)}
                          className="mt-2 w-full px-1.5 py-1 text-[11px] border border-slate-200 rounded bg-surface text-slate-600"
                        >
                          <option value="">Pindah ke…</option>
                          {targets.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
              {col.moreHref && col.count > serverShown && (
                <Link href={col.moreHref} scroll={false} className="mx-2.5 mb-2.5 py-1.5 text-center text-xs font-semibold text-slate-700 border border-dashed border-slate-300 rounded-md hover:bg-surface">
                  Muat lagi ({col.count - serverShown})
                </Link>
              )}
            </section>
          );
        })}
      </div>
      <div role="status" aria-live="polite" className={toast ? "fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-md bg-slate-900 text-white text-xs font-medium shadow-lg" : "sr-only"}>{toast}</div>
    </>
  );
}
