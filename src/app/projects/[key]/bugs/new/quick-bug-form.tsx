"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

export type QuickBugResult = { ok?: string; error?: string; key?: string; number?: number } | undefined;
type Action = (prev: QuickBugResult, formData: FormData) => Promise<QuickBugResult>;

// Remembered between reports (per user and project, this browser only).
const REMEMBER = ["moduleId", "severity", "environment", "appVersion"] as const;

// Wraps the server-rendered fields: Ctrl/Cmd+Enter saves, a saved bug empties the form for the next one,
// and the last module, severity, environment and version are filled in again.
export function QuickBugForm({ action, projectKey, draftKey, prefsKey, children }: {
  action: Action; projectKey: string; draftKey: string; prefsKey: string; children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const root = useRef<HTMLDivElement>(null);
  const lastValues = useRef<Record<string, string>>({});
  const [shots, setShots] = useState(0);

  const form = () => root.current?.querySelector("form") ?? null;
  const field = (name: string) => form()?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;

  function applyPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem(prefsKey) ?? "null") as Record<string, string> | null;
      if (!prefs) return;
      for (const name of REMEMBER) {
        const el = field(name);
        // a restored draft or something already typed wins over the remembered value
        if (el && prefs[name] && (!el.value || el.dataset.default === el.value)) el.value = prefs[name];
      }
    } catch { /* storage blocked or corrupt: start blank */ }
  }

  // First paint: remembered choices, unless there is a draft to restore.
  useEffect(() => {
    let hasDraft = false;
    try { hasDraft = Boolean(localStorage.getItem(draftKey)); } catch { /* ignore */ }
    if (!hasDraft) applyPrefs();
    field("title")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form()?.requestSubmit(); }
    };
    const onShots = (e: Event) => setShots((e as CustomEvent<number>).detail);
    const onSubmit = () => {
      lastValues.current = Object.fromEntries(REMEMBER.map((n) => [n, field(n)?.value ?? ""]));
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("bug:screenshots", onShots);
    form()?.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("bug:screenshots", onShots);
      form()?.removeEventListener("submit", onSubmit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registered once; handlers read refs
  }, []);

  // After a saved bug: remember what was chosen and put it back after React resets the form.
  useEffect(() => {
    if (!state?.key) return;
    try { localStorage.setItem(prefsKey, JSON.stringify(lastValues.current)); } catch { /* ignore */ }
    const t = setTimeout(() => { applyPrefs(); field("title")?.focus(); }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function forget() {
    try { localStorage.removeItem(prefsKey); } catch { /* ignore */ }
    for (const name of REMEMBER) { const el = field(name); if (el) el.value = el.dataset.default ?? ""; }
  }

  return (
    <div ref={root}>
      <form action={formAction} className="space-y-4 text-sm">
        {children}
        {shots > 0 && <p className="text-xs text-slate-600">📎 {shots} screenshot terlampir</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" name="intent" value="stay" disabled={pending} className="px-4 py-2 bg-action hover:bg-action-hover text-on-action text-sm font-bold rounded disabled:opacity-60">
            {pending ? "Menyimpan..." : "Simpan"}
          </button>
          <button type="submit" name="intent" value="open" disabled={pending} className="px-4 py-2 border border-slate-300 bg-surface hover:bg-slate-50 text-sm font-semibold text-slate-700 rounded disabled:opacity-60">
            Simpan & buka detail
          </button>
          <Link href={`/projects/${projectKey}`} className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900">Batal</Link>
          <span className="ml-auto text-xs text-slate-500"><kbd className="px-1 border rounded">Ctrl</kbd>+<kbd className="px-1 border rounded">Enter</kbd> simpan · <button type="button" onClick={forget} className="underline">lupakan pilihan tersimpan</button></span>
        </div>
        <div role="status" aria-live="polite" className="text-sm empty:hidden">
          {state?.error && <p data-form-error className="text-sev-blocker font-bold">{state.error}</p>}
          {state?.ok && state.number && (
            <p className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md">
              {state.ok} <Link href={`/projects/${projectKey}/bugs/${state.number}`} className="underline font-semibold">Buka {state.key}</Link>
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
