"use client";

import { useEffect, useRef, useState } from "react";

type Values = Record<string, string>;
const FIELDS = "input:not([type=file]):not([type=hidden]), textarea, select";

// Autosaves text fields to localStorage (per user+project), restores on mount, and re-fills after
// React resets the form on a rejected submit. Files (screenshots) are not saved.
export function DraftAutosave({ storageKey }: { storageKey: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [msg, setMsg] = useState("");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const els = () => Array.from(form.querySelectorAll<HTMLInputElement>(FIELDS)).filter((e) => e.name && e.type !== "checkbox");
    const read = (): Values => Object.fromEntries(els().map((e) => [e.name, e.value]));
    const write = (v: Values) => {
      for (const e of els()) {
        if (v[e.name] === undefined || e.value === v[e.name]) continue;
        e.value = v[e.name];
        e.dispatchEvent(new Event("input", { bubbles: true })); // re-trigger duplicate check
      }
    };
    const hasText = (v: Values) => Object.values(v).some((x) => x.trim());

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Values | null;
      if (saved && hasText(saved)) { write(saved); setRestored(true); }
    } catch { /* corrupt draft: ignore */ }

    let timer: ReturnType<typeof setTimeout>;
    let snapshot: Values | null = null;
    let submitted = false;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const v = read();
        try {
          if (hasText(v)) { localStorage.setItem(storageKey, JSON.stringify(v)); setMsg("Draf tersimpan otomatis di perangkat ini"); }
          else localStorage.removeItem(storageKey);
        } catch { /* storage full/blocked: skip */ }
      }, 800);
    };
    const onSubmit = () => { snapshot = read(); submitted = true; };
    const onReset = () => {
      const snap = snapshot;
      setTimeout(() => {
        // Rejected submit shows an error in the status line: put the user's text back and keep the draft.
        if (snap && form.querySelector("[role=status]")?.textContent?.trim()) { write(snap); submitted = false; }
      }, 100);
    };
    form.addEventListener("input", save);
    form.addEventListener("submit", onSubmit);
    form.addEventListener("reset", onReset);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", save);
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("reset", onReset);
      if (submitted) localStorage.removeItem(storageKey); // left page after accepted submit
    };
  }, [storageKey]);

  const discard = () => {
    localStorage.removeItem(storageKey);
    const form = anchor.current?.closest("form");
    form?.reset();
    setRestored(false);
    setMsg("Draf dihapus");
  };

  return (
    <span ref={anchor} className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <span role="status" aria-live="polite">{restored && !msg ? "Draf sebelumnya dipulihkan" : msg}</span>
      {restored && <button type="button" onClick={discard} className="underline text-action">Hapus draf</button>}
    </span>
  );
}
