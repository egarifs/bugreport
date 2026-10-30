"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

export type PaletteProject = {
  key: string;
  name: string;
  role?: string;
};

export function CommandPalette({
  projects,
  activeProjectKey,
  isAdmin,
}: {
  projects: PaletteProject[];
  activeProjectKey?: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const currentKey = activeProjectKey || projects[0]?.key;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Toggle on Cmd+K or Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Construct item list
  const allItems = useMemo(() => {
    const list: Array<{
      id: string;
      category: "Aksi Cepat" | "Halaman Project" | "Ganti Project" | "Admin & Docs";
      title: string;
      subtext?: string;
      icon: string;
      action: () => void;
    }> = [];

    // Quick Actions
    if (currentKey) {
      list.push({
        id: "action-new-bug",
        category: "Aksi Cepat",
        title: "Laporkan Bug Baru",
        subtext: `Project ${currentKey}`,
        icon: "🐛",
        action: () => router.push(`/projects/${currentKey}/bugs/new`),
      });
      list.push({
        id: "action-new-tc",
        category: "Aksi Cepat",
        title: "Buka Test Cases Repository",
        subtext: `Project ${currentKey}`,
        icon: "📋",
        action: () => router.push(`/projects/${currentKey}/test-cases`),
      });
      list.push({
        id: "action-new-run",
        category: "Aksi Cepat",
        title: "Buat Test Run Baru",
        subtext: `Project ${currentKey}`,
        icon: "▶️",
        action: () => router.push(`/projects/${currentKey}/test-runs/new`),
      });
    }

    // Direct Project Pages
    if (currentKey) {
      list.push({
        id: "nav-bugs",
        category: "Halaman Project",
        title: "Daftar Bug & Quality Gate",
        subtext: `/projects/${currentKey}`,
        icon: "🎯",
        action: () => router.push(`/projects/${currentKey}`),
      });
      list.push({
        id: "nav-test-cases",
        category: "Halaman Project",
        title: "Test Cases & Test Runs",
        subtext: `/projects/${currentKey}/test-cases`,
        icon: "✅",
        action: () => router.push(`/projects/${currentKey}/test-cases`),
      });
      list.push({
        id: "nav-docs",
        category: "Halaman Project",
        title: "Dokumen Bisnis (PRD / SRS)",
        subtext: `/projects/${currentKey}/docs`,
        icon: "📄",
        action: () => router.push(`/projects/${currentKey}/docs`),
      });
      list.push({
        id: "nav-chat",
        category: "Halaman Project",
        title: "AI Project Chat",
        subtext: `/projects/${currentKey}/chat`,
        icon: "💬",
        action: () => router.push(`/projects/${currentKey}/chat`),
      });
      list.push({
        id: "nav-reports",
        category: "Halaman Project",
        title: "Laporan Kesiapan Rilis",
        subtext: `/projects/${currentKey}/reports`,
        icon: "📊",
        action: () => router.push(`/projects/${currentKey}/reports`),
      });
      list.push({
        id: "nav-settings",
        category: "Halaman Project",
        title: "Pengaturan & Modul Project",
        subtext: `/projects/${currentKey}/settings`,
        icon: "⚙️",
        action: () => router.push(`/projects/${currentKey}/settings`),
      });
    }

    // Projects Switching
    for (const p of projects) {
      if (p.key !== currentKey) {
        list.push({
          id: `proj-${p.key}`,
          category: "Ganti Project",
          title: `Pindah ke: ${p.name}`,
          subtext: `Project Key: ${p.key} (${p.role || "Member"})`,
          icon: "📁",
          action: () => router.push(`/projects/${p.key}`),
        });
      }
    }

    // Admin & Docs
    list.push({
      id: "global-api-docs",
      category: "Admin & Docs",
      title: "API & Swagger Docs (OpenAPI)",
      subtext: "/api-docs",
      icon: "⚡",
      action: () => router.push("/api-docs"),
    });

    if (isAdmin) {
      list.push({
        id: "admin-users",
        category: "Admin & Docs",
        title: "User Approvals & Management",
        subtext: "/admin/users",
        icon: "👥",
        action: () => router.push("/admin/users"),
      });
      list.push({
        id: "admin-new-project",
        category: "Admin & Docs",
        title: "Buat Project Baru",
        subtext: "/projects/new",
        icon: "➕",
        action: () => router.push("/projects/new"),
      });
    }

    return list;
  }, [projects, currentKey, isAdmin, router]);

  // Filter items based on query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;

    // Check if user is typing a direct bug number (e.g. "6" or "crm-6")
    const matchBug = q.match(/^(?:([a-z0-9_-]+)-)?(\d+)$/i);
    const extra: typeof allItems = [];
    if (matchBug && currentKey) {
      const proj = matchBug[1] ? matchBug[1].toUpperCase() : currentKey;
      const num = matchBug[2];
      extra.push({
        id: `direct-bug-${proj}-${num}`,
        category: "Aksi Cepat",
        title: `Lompat langsung ke Bug #${proj}-${num}`,
        subtext: `Buka detail bug /projects/${proj}/bugs/${num}`,
        icon: "🚀",
        action: () => router.push(`/projects/${proj}/bugs/${num}`),
      });
    }

    const matches = allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtext && item.subtext.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );

    return [...extra, ...matches];
  }, [allItems, query, currentKey, router]);

  // Reset selectedIndex when filtered changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  function handleSelect(item: (typeof allItems)[0]) {
    setOpen(false);
    item.action();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  }

  const modalContent = open ? (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-24 px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden chat-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-white">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari halaman, ketik 'CRM-6', atau pilih aksi..."
            className="w-full text-sm bg-transparent focus:outline-none placeholder:text-slate-400 text-slate-800 font-medium"
          />
          <kbd
            onClick={() => setOpen(false)}
            className="cursor-pointer px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
          >
            ESC
          </kbd>
        </div>

        {/* Suggestions & Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1 text-xs">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              Tidak ada perintah atau halaman yang cocok dengan &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <p className={`font-semibold truncate text-xs ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {item.title}
                      </p>
                      {item.subtext && (
                        <p className={`text-[11px] truncate ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                          {item.subtext}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded shrink-0 ml-3 ${
                      isSelected ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ navigasi</span>
            <span>↵ pilih</span>
            <span>esc tutup</span>
          </div>
          <span className="font-sans font-medium text-slate-400">BugReport Command</span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Mini trigger button to display in sidebar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200/80 rounded border border-slate-200 transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="truncate">Cari perintah...</span>
        </div>
        <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-300 rounded shadow-2xs">
          ⌘K
        </kbd>
      </button>

      {/* Render outside sidebar container using React Portal so it is never clipped */}
      {mounted && typeof document !== "undefined" && createPortal(modalContent, document.body)}
    </>
  );
}
