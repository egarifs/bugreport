"use client";

import { useActionState, useEffect, useState } from "react";
import { bulkAction, type BulkResult } from "./bulk-actions";

const FIELD = "px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-surface text-slate-800";
const BTN = "px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-surface hover:bg-slate-100 disabled:opacity-50";

// Row checkboxes live in the table and point at this form with form="bulk-form"; the bar shows once any is checked.
export function BulkBar({ projectKey, statuses, members }: {
  projectKey: string;
  statuses: { value: string; label: string }[];
  members: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<BulkResult, FormData>(bulkAction.bind(null, projectKey), undefined);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const boxes = () => [...document.querySelectorAll<HTMLInputElement>('input[name="ids"][form="bulk-form"]')];
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.id === "bulk-all") boxes().forEach((b) => (b.checked = t.checked));
      update();
    };
    update(); // boxes ticked before hydration (or restored by the browser) still count
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  // After a successful run, clear the selection.
  useEffect(() => {
    if (state?.ok) {
      document.querySelectorAll<HTMLInputElement>('input[name="ids"][form="bulk-form"], #bulk-all').forEach((b) => (b.checked = false));
      setCount(0);
    }
  }, [state]);

  return (
    <form id="bulk-form" action={action} aria-label="Aksi massal" className={count > 0 || state ? "mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 border border-action rounded-lg bg-action-soft text-xs" : "hidden"}>
      <span className="font-semibold text-slate-900"><span className="font-mono">{count}</span> dipilih</span>
      <span className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor="bulk-status">Status tujuan</label>
        <select id="bulk-status" name="status" defaultValue="" className={FIELD}>
          <option value="">Ubah status…</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="submit" name="intent" value="status" disabled={pending || count === 0} className={BTN}>Terapkan</button>
      </span>
      <span className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor="bulk-assignee">Assignee</label>
        <select id="bulk-assignee" name="assignee" defaultValue="" className={FIELD}>
          <option value="">Assign ke…</option>
          <option value="none">Tanpa assignee</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button type="submit" name="intent" value="assign" disabled={pending || count === 0} className={BTN}>Terapkan</button>
      </span>
      <span className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor="bulk-tag">Tag</label>
        <input id="bulk-tag" name="tag" maxLength={30} placeholder="Tambah tag" className={`${FIELD} w-28`} />
        <button type="submit" name="intent" value="tag" disabled={pending || count === 0} className={BTN}>Tambah</button>
      </span>
      <span role="status" aria-live="polite" className={state?.error ? "text-bad font-semibold" : "text-slate-700"}>{state?.error ?? state?.ok}</span>
    </form>
  );
}
