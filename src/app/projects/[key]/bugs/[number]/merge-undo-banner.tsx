"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UndoBannerProps {
  initialRemainingMs: number;
  targetKey: string;
  sourceKey?: string;
  onUndoAction: () => Promise<{ error?: string; success?: boolean }>;
}

export function MergeUndoBanner({ initialRemainingMs, targetKey, onUndoAction }: UndoBannerProps) {
  const [remainingSec, setRemainingSec] = useState(Math.floor(initialRemainingMs / 1000));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (remainingSec <= 0) return;
    const interval = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSec]);

  if (remainingSec <= 0) {
    return null;
  }

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const timeLabel = `${mins}:${secs.toString().padStart(2, "0")}`;

  function handleUndo() {
    setError(null);
    startTransition(async () => {
      const res = await onUndoAction();
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div
      role="status"
      className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="font-bold text-amber-600">≡</span>
        <div>
          <span>
            Bug ini digabung ke <b>{targetKey}</b>. Batalkan dalam <b>{timeLabel}</b>.
          </span>
          {error && <p className="text-red-600 mt-0.5">{error}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={handleUndo}
        disabled={isPending}
        className="px-3 py-1 font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-300 disabled:opacity-50 border border-amber-300 rounded transition-colors"
      >
        {isPending ? "Membatalkan..." : "Urungkan gabung"}
      </button>
    </div>
  );
}
