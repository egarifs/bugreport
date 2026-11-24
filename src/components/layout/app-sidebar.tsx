"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { NotificationBell } from "./notification-bell";
import { CommandPalette } from "./command-palette";
import { UserProfileMenu } from "./user-profile-menu";
import { handleSignOut } from "./auth-actions";

interface ProjectOption {
  id: string;
  key: string;
  name: string;
  role?: string;
  // Permissions the user holds in this project; computed server-side, used only to hide menu items.
  perms: string[];
}

interface AppSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    isAdmin?: boolean;
    role?: string;
  };
  projects: ProjectOption[];
  activeProjectKey?: string;
}

export function AppSidebar({ user, projects, activeProjectKey }: AppSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Restore collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bugreport_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("bugreport_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      previousFocusRef.current = menuButtonRef.current;
      activeLinkRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key === "Tab" && !sidebarRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        activeLinkRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const currentKey = activeProjectKey || projects[0]?.key;
  const currentProject = projects.find((p) => p.key === currentKey);

  const navItems = [
    {
      label: "Bug",
      perm: "project.read",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v1m6 11h2m-6 0h-4m4-7v7m0 0l-3 3m3-3l3 3M4 11h2m2-5a4 4 0 018 0v2H8V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11a4 4 0 11-8 0v6a4 4 0 008 0v-6z" />
        </svg>
      ),
      href: currentKey ? `/projects/${currentKey}` : "/projects",
      active: currentKey ? pathname === `/projects/${currentKey}` || pathname.startsWith(`/projects/${currentKey}/bugs`) : pathname === "/projects",
      badge: null,
    },
    {
      label: "Sprint",
      perm: "project.read",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
        </svg>
      ),
      href: currentKey ? `/projects/${currentKey}/sprints` : "/projects",
      active: pathname.includes("/sprints"),
      badge: null,
    },
    {
      label: "Test case",
      perm: "testcase.read",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      href: currentKey ? `/projects/${currentKey}/test-cases` : "/projects",
      active: pathname.includes("/test-cases"),
      badge: null,
    },
    {
      label: "Dokumen bisnis",
      perm: "doc.read",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      href: currentKey ? `/projects/${currentKey}/docs` : "/projects",
      active: pathname.includes("/docs"),
      badge: null,
    },
    {
      label: "AI Chat",
      perm: "chat.ask",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      href: currentKey ? `/projects/${currentKey}/chat` : "/projects",
      active: pathname.includes("/chat"),
      badge: null,
    },
    {
      label: "Laporan",
      perm: "project.read",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6m4 6V9m4 10V5M5 19h14" />
        </svg>
      ),
      href: currentKey ? `/projects/${currentKey}/reports` : "/projects",
      active: pathname.includes("/reports"),
      badge: null,
    },
    {
      label: "Pengaturan",
      perm: "project.read",
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      href: currentKey ? `/projects/${currentKey}/settings` : "/projects",
      active: pathname.endsWith("/settings"),
      badge: null,
    },
  ].filter((item) => !currentProject || currentProject.perms.includes(item.perm));

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between bg-surface border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            ref={menuButtonRef}
            onClick={() => setMobileOpen((open) => !open)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
            aria-label={mobileOpen ? "Tutup navigasi" : "Buka navigasi"}
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-slate-900 text-sm">BugReport</span>
        </div>
        <div className="flex items-center gap-2">
          {currentProject && (
            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
              {currentProject.key}
            </span>
          )}
          <NotificationBell align="right" />
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-scrim/40 z-40 md:hidden cursor-default"
          aria-label="Tutup navigasi"
          onClick={() => {
            setMobileOpen(false);
            menuButtonRef.current?.focus();
          }}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        role="dialog"
        aria-label="Navigasi utama"
        className={`fixed inset-y-0 left-0 z-50 bg-surface border-r border-slate-200 flex flex-col transition-all duration-200 motion-reduce:transition-none md:static ${
          collapsed ? "w-16" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header: Project Brand & Project Switcher (Unified minimal popover feel) */}
        <div className="border-b border-slate-200/80 px-2.5 py-3">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1.5 px-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {currentProject ? currentProject.key.slice(0, 3) : "BR"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-slate-900 truncate tracking-tight">
                      {currentProject ? currentProject.name : "BugReport"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      {currentProject ? currentProject.key : "Central"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <div className="hidden md:block">
                    <NotificationBell />
                  </div>
                  <button
                    onClick={toggleCollapsed}
                    className="hidden md:inline-flex p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Collapse sidebar"
                    aria-label="Collapse sidebar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {projects.length > 1 ? (
                <div className="relative">
                  <select
                    value={currentKey || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        window.location.href = `/projects/${e.target.value}`;
                      }
                    }}
                    aria-label="Ganti project"
                    className="w-full text-xs py-1.5 pl-2 pr-6 border border-slate-200 rounded-md bg-slate-50/70 hover:bg-slate-50 text-slate-700 font-medium truncate focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none transition-colors cursor-pointer"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.key}>
                        {p.key} — {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              ) : null}

              <CommandPalette
                projects={projects.map((p) => ({ key: p.key, name: p.name, role: p.role }))}
                activeProjectKey={currentKey}
                isAdmin={user.isAdmin}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="w-7 h-7 rounded-md bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shadow-2xs">
                {currentProject ? currentProject.key.slice(0, 3) : "BR"}
              </div>
              <button
                onClick={toggleCollapsed}
                className="hidden md:inline-flex p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <svg className="w-3.5 h-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {collapsed && (
          <div className="hidden md:flex justify-center py-2 border-b border-slate-100">
            <NotificationBell />
          </div>
        )}

        {/* Navigation Menu Items */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto" aria-label="Menu project">
          {navItems.map((item) => (
            <Link
              key={item.label}
              ref={item.active && mobileOpen ? activeLinkRef : undefined}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                item.active
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${collapsed ? "justify-center px-1.5" : ""}`}
            >
              {item.icon}
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="text-[10px] font-mono px-1 py-0.2 bg-slate-100 text-slate-600 rounded">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}

          {/* Developer Tools */}
          <div className="pt-2.5 mt-2.5 border-t border-slate-100">
            {!collapsed && (
              <p className="px-2.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
                Developer & Tools
              </p>
            )}
            <Link
              href="/api-docs"
              title={collapsed ? "API & Swagger Docs" : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                pathname === "/api-docs"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${collapsed ? "justify-center px-1.5" : ""}`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              {!collapsed && <span className="flex-1 truncate">API & Swagger Docs</span>}
            </Link>
          </div>

          {/* Admin Section (Conditional) */}
          {user.isAdmin && (
            <div className="pt-2 mt-2">
              {!collapsed && (
                <p className="px-2.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
                  Administrator
                </p>
              )}
              <Link
                href="/admin/users"
                title={collapsed ? "Approval Queue" : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                  pathname === "/admin/users"
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed ? "justify-center px-1.5" : ""}`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {!collapsed && <span className="flex-1 truncate">User Approvals</span>}
              </Link>
              <Link
                href="/admin/rbac"
                title={collapsed ? "Kelola RBAC" : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                  pathname.startsWith("/admin/rbac")
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed ? "justify-center px-1.5" : ""}`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {!collapsed && <span className="flex-1 truncate">Kelola RBAC</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* Footer: User Profile & Multi-Theme Menu */}
        <div className="p-2 border-t border-slate-200">
          <UserProfileMenu
            user={user}
            collapsed={collapsed}
            onSignOut={handleSignOut}
          />
        </div>
      </aside>
    </>
  );
}
