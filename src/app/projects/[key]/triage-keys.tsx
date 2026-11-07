"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// J/K move selection, A accept, X reject, Enter opens detail. Ignored while typing in a field.
export function TriageKeys({ keys, selected, basePath, detailHref }: {
  keys: string[]; selected: string | null; basePath: string; detailHref: string | null;
}) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input,select,textarea,[contenteditable],dialog,[role=dialog]")) return;
      const i = selected ? keys.indexOf(selected) : -1;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "k") {
        const next = keys[Math.min(keys.length - 1, Math.max(0, i + (k === "j" ? 1 : -1)))];
        if (next) { e.preventDefault(); router.replace(`${basePath}${encodeURIComponent(next)}`, { scroll: false }); }
      } else if (k === "a" || k === "x") {
        document.getElementById(k === "a" ? "triage-accept" : "triage-reject")?.click();
      } else if (e.key === "Enter" && detailHref && !t.closest("a,button")) {
        router.push(detailHref);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, selected, basePath, detailHref, router]);
  return null;
}
