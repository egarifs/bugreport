"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { THEME_STORAGE_KEY, applyTheme, normalizeTheme, type ThemeChoice } from "@/lib/theme";

export type ProfileUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean;
};


export function UserProfileMenu({
  user,
  collapsed,
  onSignOut,
}: {
  user: ProfileUser;
  collapsed: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeChoice>("system");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTheme(normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY)));
  }, []);

  function handleThemeChange(t: ThemeChoice) {
    setCurrentTheme(t);
    localStorage.setItem(THEME_STORAGE_KEY, t);
    applyTheme(t);
  }

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const displayName = user.name || user.email?.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        data-testid="profile-menu-trigger"
        aria-haspopup="menu"
        title={collapsed ? `${displayName} (${user.isAdmin ? "Super Admin" : "Member"})` : undefined}
        className={`w-full flex items-center gap-3 p-1.5 rounded-lg text-left transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
          collapsed ? "justify-center" : "justify-between"
        } ${open ? "bg-slate-100" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar Anchor */}
          <div className="w-8 h-8 rounded-full bg-ink text-on-ink flex items-center justify-center font-semibold text-xs shrink-0 shadow-2xs">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initial
            )}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    user.isAdmin ? "bg-indigo-600" : "bg-emerald-500"
                  }`}
                />
                {user.isAdmin ? "Super Admin" : "Active Member"}
              </p>
            </div>
          )}
        </div>

        {!collapsed && (
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
      </button>

      {/* Popover Menu (Flyout Upwards) */}
      {open && (
        <div
          role="menu"
          className={`absolute bottom-full mb-2 z-50 bg-surface rounded-xl shadow-2xl border border-slate-200 py-2 min-w-72 chat-in ${
            collapsed ? "left-0" : "left-0 right-0"
          }`}
        >
          {/* Account Details Header */}
          <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
            <p className="text-xs font-bold text-slate-900 truncate">
              {user.name || "Pengguna"}
            </p>
            <p className="text-[11px] text-slate-500 truncate font-mono">
              {user.email}
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                  user.isAdmin
                    ? "bg-action-soft text-link border border-action/30"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {user.isAdmin ? "Super Admin" : "Project Member"}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">v1.0-prod</span>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="px-3 py-2 border-b border-slate-100">
            <p id="theme-label" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Tema
            </p>
            <div role="group" aria-labelledby="theme-label" className="grid grid-cols-3 gap-1.5 text-xs">
              {([["system", "Ikut sistem"], ["light", "Terang"], ["dark", "Gelap"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={currentTheme === value}
                  onClick={() => handleThemeChange(value)}
                  className={`min-h-[44px] px-2 rounded border text-[11px] font-medium transition-colors duration-fast ease-out ${
                    currentTheme === value
                      ? "bg-ink text-on-ink border-ink"
                      : "bg-surface text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Menu Links */}
          <div className="py-1">
            <Link
              href="/profile/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              role="menuitem"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Preferensi Notifikasi</span>
            </Link>

            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              role="menuitem"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>Daftar Semua Project</span>
            </Link>

            <Link
              href="/api-docs"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              role="menuitem"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>Dokumentasi API (Swagger)</span>
            </Link>
          </div>

          <div className="border-t border-slate-100 my-1" />

          {/* Sign Out Action */}
          <div className="px-1.5 py-0.5">
            <form
              action={async () => {
                setOpen(false);
                await onSignOut();
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-bad hover:bg-bad-bg rounded-md transition-colors"
                role="menuitem"
              >
                <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Keluar (Sign Out)</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
