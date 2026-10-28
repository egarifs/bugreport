"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

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
  };
  projects: ProjectOption[];
  activeProjectKey?: string;
}

export function AppSidebar({ user, projects, activeProjectKey }: AppSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-slate-900 text-sm">BugReport</span>
        </div>
        {currentProject && (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
            {currentProject.key}
          </span>
        )}
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 md:static ${
          collapsed ? "w-16" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header: Project Brand & Project Switcher */}
        <div className="h-16 border-b border-slate-200 px-3 flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                {currentProject ? currentProject.key.slice(0, 3) : "BR"}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs text-slate-900 truncate">
                  {currentProject ? currentProject.name : "BugReport"}
                </p>
                <p className="text-xs text-slate-400 font-mono truncate">
                  {currentProject ? `Project: ${currentProject.key}` : "Central Tracker"}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-lg bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center">
              {currentProject ? currentProject.key.slice(0, 3) : "BR"}
            </div>
          )}

          {/* Desktop Collapse Button */}
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Project Switcher Select (when expanded and has multiple projects) */}
        {!collapsed && projects.length > 0 && (
          <div className="p-3 border-b border-slate-100">
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Pilih Project
            </label>
            <select
              value={currentKey || ""}
              onChange={(e) => {
                if (e.target.value) {
                  window.location.href = `/projects/${e.target.value}`;
                }
              }}
              className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-medium truncate focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.key}>
                  {p.key} - {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Menu Items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                item.active
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              {item.icon}
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}

          {/* Developer Tools */}
          <div className="pt-3 mt-3 border-t border-slate-100">
            {!collapsed && (
              <p className="px-3 text-xs font-semibold text-slate-400 mb-1">
                Developer & Tools
              </p>
            )}
            <Link
              href="/api-docs"
              title={collapsed ? "API & Swagger Docs" : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                pathname === "/api-docs"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${collapsed ? "justify-center px-2" : ""}`}
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
                <p className="px-3 text-xs font-semibold text-slate-400 mb-1">
                  Administrator
                </p>
              )}
              <Link
                href="/admin/users"
                title={collapsed ? "Approval Queue" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  pathname.startsWith("/admin")
                    ? "bg-purple-900 text-white"
                    : "text-purple-700 hover:bg-purple-50"
                } ${collapsed ? "justify-center px-2" : ""}`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {!collapsed && <span className="flex-1 truncate">User Approvals</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* Footer: User Profile & Logout */}
        <div className="p-3 border-t border-slate-200">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user.isAdmin ? "Super Admin" : "Active Member"}
                </p>
              </div>
              <Link
                href="/projects"
                title="All Projects"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="flex justify-center">
              <div
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center cursor-default"
                title={user.name || user.email || "User"}
              >
                {(user.name || user.email || "U")[0].toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
