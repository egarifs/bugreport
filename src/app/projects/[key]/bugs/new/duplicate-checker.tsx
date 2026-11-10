"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BugStatus } from "@prisma/client";
import { statusLabel } from "@/lib/status-dictionary";

interface DuplicateItem {
  id: string;
  key: string;
  number: number;
  title: string;
  status: string;
  severity: string;
  similarity: number;
}

export function DuplicateChecker({ projectKey }: { projectKey: string }) {
  const [query, setQuery] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const titleInput = document.getElementById("bug-title-input") as HTMLInputElement | null;
    if (!titleInput) return;

    let timeoutId: NodeJS.Timeout;
    const handleInput = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setQuery(titleInput.value.trim());
      }, 400);
    };

    titleInput.addEventListener("input", handleInput);
    return () => {
      titleInput.removeEventListener("input", handleInput);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (query.length < 4) {
      setDuplicates([]);
      return;
    }

    let active = true;
    setLoading(true);
    fetch(`/api/projects/${projectKey}/duplicates?q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setDuplicates(data.duplicates || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, projectKey]);

  if (duplicates.length === 0) return null;

  return (
    <div role="status" aria-live="polite" className="p-3 bg-warn-bg border border-warn-border rounded-lg text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-warn flex items-center gap-1.5">
          Mirip {duplicates[0].key}{duplicates.length > 1 ? ` dan ${duplicates.length - 1} lainnya` : ""}
        </span>
        {loading && <span className="text-xs text-warn">Mencari...</span>}
      </div>
      <p className="text-xs text-warn">
        Bug yang sama? Tambahkan info Anda sebagai komentar di sana. Laporan tetap bisa dikirim.
      </p>
      <ul className="space-y-1.5 divide-y divide-amber-200/50">
        {duplicates.map((d) => (
          <li key={d.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-bold text-warn shrink-0">{d.key}</span>
              <span className="text-slate-800 truncate">{d.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-1.5 py-0.5 rounded text-xs bg-warn-bg/60 text-warn font-medium">
                {statusLabel(d.status as BugStatus)}
              </span>
              <span className="text-xs text-warn">
                {(d.similarity * 100).toFixed(0)}% mirip
              </span>
              <Link
                href={`/projects/${projectKey}/bugs/${d.number}`}
                target="_blank"
                className="text-warn font-semibold underline hover:text-warn"
              >
                Buka ↗
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
