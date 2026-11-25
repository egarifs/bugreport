"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "N" opens the report form from the bug list. Ignored while typing, with modifiers, or inside dialogs.
export function NewBugShortcut({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || t.closest("input,select,textarea,[contenteditable],dialog,[role=dialog]")) return;
      e.preventDefault();
      router.push(href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);
  return null;
}
