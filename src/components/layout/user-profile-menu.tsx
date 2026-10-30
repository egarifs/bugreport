"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export type ProfileUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean;
};

export type ThemeChoice = "default" | "claude" | "chatgpt" | "antigravity";

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
  const [currentTheme, setCurrentTheme] = useState<ThemeChoice>("default");
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync theme with localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bugreport-theme") as ThemeChoice;
    if (saved) {
      setCurrentTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  function handleThemeChange(t: ThemeChoice) {
    setCurrentTheme(t);
    localStorage.setItem("bugreport-theme", t);
    document.documentElement.setAttribute("data-theme", t);
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
        aria-haspopup="menu"
        title={collapsed ? `${displayName} (${user.isAdmin ? "Super Admin" : "Member"})` : undefined}
        className={`w-full flex items-center gap-3 p-1.5 rounded-lg text-left transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
          collapsed ? "justify-center" : "justify-between"
        } ${open ? "bg-slate-100" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar Anchor */}
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-2xs">
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
          className={`absolute bottom-full mb-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-72 chat-in ${
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
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
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
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span>🎨</span> Pilihan Tema
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleThemeChange("default")}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-medium transition-colors ${
                  currentTheme === "default"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                Default Slate
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange("claude")}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-medium transition-colors ${
                  currentTheme === "claude"
                    ? "bg-[#D97757] text-white border-[#D97757]"
                    : "bg-[#FAF7F2] text-[#242220] border-[#E7E1D8] hover:bg-[#F2ECE4]"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#D97757] shrink-0" />
                Claude Warm
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange("chatgpt")}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-medium transition-colors ${
                  currentTheme === "chatgpt"
                    ? "bg-[#10A37F] text-white border-[#10A37F]"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#10A37F] shrink-0" />
                ChatGPT Green
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange("antigravity")}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-medium transition-colors ${
                  currentTheme === "antigravity"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                Antigravity Dark
              </button>
            </div>
          </div>

          {/* Quick Menu Links */}
          <div className="py-1">
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
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
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
