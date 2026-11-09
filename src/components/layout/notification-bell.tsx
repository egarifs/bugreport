"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TypeIcon, timeAgo } from "./notification-parts";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  actorName: string;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 60_000;

export function markRead(body: { id: string } | { all: true }) {
  return fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function NotificationBell({ align = "left" }: { align?: "left" | "right" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [focusUntil, setFocusUntil] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const poll = useCallback(async () => {
    if (document.hidden) return;
    const r = await fetch("/api/notifications?count=1").catch(() => null);
    if (r?.ok) {
      const j = await r.json();
      setUnread(j.unread);
      setIsFocusActive(Boolean(j.isFocusActive));
      setFocusUntil(j.focusUntil ?? null);
    }
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    const r = await fetch("/api/notifications").catch(() => null);
    if (!r?.ok) return setFailed(true);
    const j = await r.json();
    setItems(j.items);
    setUnread(j.unread);
    setIsFocusActive(Boolean(j.isFocusActive));
    setFocusUntil(j.focusUntil ?? null);
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [poll, pathname]);

  useEffect(() => {
    if (!open) return;
    load();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, load]);

  useEffect(() => setOpen(false), [pathname]);

  const openItem = async (n: NotificationItem) => {
    if (!n.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((xs) => xs?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
      markRead({ id: n.id });
    }
    setOpen(false);
    router.push(n.href);
  };

  const readAll = async () => {
    setUnread(0);
    setItems((xs) => xs?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
    await markRead({ all: true });
  };

  const toggleFocus = async (hours: number | null) => {
    const res = await fetch("/api/notifications/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setIsFocusActive(Boolean(data.isFocusActive));
      setFocusUntil(data.focusUntil ?? null);
      poll();
    }
  };

  const label = unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi";

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        className={`relative p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 ${open ? "bg-slate-100 text-slate-900" : ""}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold leading-[18px] text-center ring-2 ring-white chat-in" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifikasi"
          className={`absolute z-[60] mt-2 w-[min(24rem,calc(100vw-1.5rem))] bg-white border border-slate-200 rounded-lg shadow-lg chat-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <p className="font-bold text-sm text-slate-900">
              Notifikasi{unread > 0 && <span className="ml-1.5 font-normal text-slate-500">· {unread} baru</span>}
            </p>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline-offset-2 hover:underline">
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* Mode Fokus Quick Toggle Banner */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
            {isFocusActive ? (
              <>
                <span className="text-amber-800 font-medium flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Mode fokus aktif {focusUntil ? `s.d. ${new Date(focusUntil).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => toggleFocus(null)}
                  className="text-amber-900 font-semibold hover:underline shrink-0 ml-2"
                >
                  Matikan
                </button>
              </>
            ) : (
              <>
                <span className="text-slate-600 flex items-center gap-1">
                  <span>🌙</span> Mode fokus:
                </span>
                <div className="flex items-center gap-1 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleFocus(1)}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    1j
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFocus(2)}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    2j
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFocus(4)}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    4j
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {failed ? (
              <div className="p-6 text-center text-sm text-slate-600">
                Gagal memuat notifikasi.{" "}
                <button onClick={load} className="font-semibold underline">Coba lagi</button>
              </div>
            ) : items === null ? (
              <ul aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex gap-3 px-4 py-3 animate-pulse motion-reduce:animate-none">
                    <span className="w-8 h-8 rounded-full bg-slate-100" />
                    <span className="flex-1 space-y-2 py-1">
                      <span className="block h-3 w-3/4 rounded bg-slate-100" />
                      <span className="block h-3 w-1/2 rounded bg-slate-100" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-semibold text-sm text-slate-900">Belum ada notifikasi</p>
                <p className="mt-1 text-xs text-slate-500">Anda akan diberi tahu saat bug di-assign ke Anda, dikomentari, atau statusnya berubah.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openItem(n)}
                      className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:bg-slate-50 ${n.readAt ? "" : "bg-slate-50/60"}`}
                    >
                      <TypeIcon type={n.type} />
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm ${n.readAt ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</span>
                        {n.body && <span className="block text-xs text-slate-500 truncate mt-0.5">{n.body}</span>}
                        <span className="block text-xs text-slate-500 mt-1">{timeAgo(n.createdAt)}</span>
                      </span>
                      {!n.readAt && <span className="mt-2 w-2 h-2 shrink-0 rounded-full bg-rose-600" aria-label="Belum dibaca" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 border-t border-slate-200 text-center text-xs font-semibold text-slate-700">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 hover:bg-slate-50 border-r border-slate-200"
            >
              Lihat semua
            </Link>
            <Link
              href="/profile/notifications"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 hover:bg-slate-50 text-indigo-600 hover:text-indigo-700"
            >
              Atur preferensi
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
