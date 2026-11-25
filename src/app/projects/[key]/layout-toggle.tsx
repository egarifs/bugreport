"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const STORE = "bug-layout";

// List / Board switch. The URL (?layout=) wins; localStorage only supplies the default when the URL says nothing.
export function LayoutToggle({ current, listHref, boardHref }: { current: "list" | "board"; listHref: string; boardHref: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  useEffect(() => {
    try {
      if (sp.has("layout")) localStorage.setItem(STORE, current);
      else if (localStorage.getItem(STORE) === "board") router.replace(boardHref, { scroll: false });
    } catch { /* storage blocked: URL still works */ }
  }, [sp, current, boardHref, router]);

  const item = (id: "list" | "board", label: string, href: string) => (
    <Link
      href={href}
      scroll={false}
      aria-current={current === id ? "true" : undefined}
      className={`px-3 py-1.5 text-xs font-semibold ${current === id ? "bg-slate-900 text-white" : "bg-surface text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </Link>
  );
  return (
    <div role="group" aria-label="Tampilan" className="inline-flex border border-slate-200 rounded-md overflow-hidden">
      {item("list", "List", listHref)}
      {item("board", "Board", boardHref)}
    </div>
  );
}
