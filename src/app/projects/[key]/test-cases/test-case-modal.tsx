"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TestCasePriority, TestCaseStatus } from "@prisma/client";
import { bulkMoveTestCasesAction } from "./test-case-actions";

export type TestCaseItem = {
  id: string;
  code: string;
  title: string;
  priority: TestCasePriority;
  status?: TestCaseStatus;
  moduleId: string | null;
  moduleArea: string | null;
  moduleName?: string | null;
  testType: string | null;
  targetRole: string | null;
  precondition: string | null;
  steps: string;
  expectedResult: string;
  referenceUrl: string | null;
};

export type ModuleOption = { id: string; name: string };

const KNOWN_TYPES = ["Functional", "Negative", "Security", "UI", "Integration", "Smoke", "Regression"];

export function TestCaseManagementSection({
  projectId,
  projectKey,
  canManage,
  modules,
  testCases,
}: {
  projectId: string;
  projectKey: string;
  canManage: boolean;
  modules: ModuleOption[];
  testCases: TestCaseItem[];
}) {
  const router = useRouter();

  // Filters state
  const [selectedModuleId, setSelectedModuleId] = useState<string | "ALL" | "UNASSIGNED">("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [moduleSearch, setModuleSearch] = useState<string>("");
  const [tcSearch, setTcSearch] = useState<string>("");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk move modal state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetMoveModuleId, setTargetMoveModuleId] = useState<string>("");
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Module counts
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: testCases.length, UNASSIGNED: 0 };
    for (const m of modules) {
      counts[m.id] = 0;
    }
    for (const tc of testCases) {
      if (tc.moduleId && counts[tc.moduleId] !== undefined) {
        counts[tc.moduleId] += 1;
      } else {
        counts.UNASSIGNED += 1;
      }
    }
    return counts;
  }, [modules, testCases]);

  // Types list
  const availableTypes = useMemo(() => {
    const set = new Set<string>(KNOWN_TYPES);
    for (const tc of testCases) {
      if (tc.testType?.trim()) set.add(tc.testType.trim());
    }
    return Array.from(set);
  }, [testCases]);

  // Module filter list
  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) => m.name.toLowerCase().includes(q));
  }, [modules, moduleSearch]);

  // Filtered test cases
  const filteredTestCases = useMemo(() => {
    return testCases.filter((tc) => {
      if (selectedModuleId === "UNASSIGNED") {
        if (tc.moduleId !== null) return false;
      } else if (selectedModuleId !== "ALL") {
        if (tc.moduleId !== selectedModuleId) return false;
      }

      if (selectedType !== "ALL") {
        const typeNormalized = (tc.testType || "Functional").trim().toLowerCase();
        if (typeNormalized !== selectedType.toLowerCase()) return false;
      }

      if (selectedPriority !== "ALL") {
        if (tc.priority !== selectedPriority) return false;
      }

      if (tcSearch.trim()) {
        const q = tcSearch.toLowerCase().trim();
        const codeMatch = tc.code.toLowerCase().includes(q);
        const titleMatch = tc.title.toLowerCase().includes(q);
        const stepsMatch = tc.steps.toLowerCase().includes(q);
        if (!codeMatch && !titleMatch && !stepsMatch) return false;
      }

      return true;
    });
  }, [testCases, selectedModuleId, selectedType, selectedPriority, tcSearch]);

  // Checkbox helpers
  const allFilteredSelected =
    filteredTestCases.length > 0 &&
    filteredTestCases.every((tc) => selectedIds.has(tc.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filteredTestCases.forEach((tc) => next.delete(tc.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredTestCases.forEach((tc) => next.add(tc.id));
      setSelectedIds(next);
    }
  }

  function toggleSelectOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  async function handleBulkMove() {
    if (!selectedIds.size) return;
    setMoving(true);
    setMoveError(null);
    const res = await bulkMoveTestCasesAction(
      projectId,
      projectKey,
      Array.from(selectedIds),
      targetMoveModuleId ? targetMoveModuleId : null
    );
    setMoving(false);
    if (res && "error" in res && res.error) {
      setMoveError(res.error);
      return;
    }
    setShowMoveModal(false);
    setSelectedIds(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-text-base">Repository Test Case</h2>
          <p className="text-xs text-text-muted">
            Total {testCases.length} skenario pengujian di project {projectKey}.
          </p>
        </div>

        {canManage && (
          <Link
            href={`/projects/${projectKey}/test-cases/new`}
            className="px-4 py-2 bg-action hover:bg-action-hover text-on-action text-xs font-bold rounded-lg shadow-sm transition min-h-[44px] flex items-center"
          >
            + Test case baru
          </Link>
        )}
      </div>

      {/* Two-Column Layout (Mockup 23) */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* LEFT COLUMN: MODULE NAVIGATION */}
        <aside className="w-full lg:w-60 bg-surface-raised border border-border-base rounded-lg p-3 shrink-0 space-y-2.5">
          <div className="px-1 py-0.5 text-xs font-bold text-text-muted">
            Modul
          </div>

          <div className="relative">
            <input
              type="text"
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              placeholder="Cari modul..."
              className="w-full px-2.5 py-1.5 text-xs border border-border-base rounded bg-surface-sunken focus:bg-surface-raised focus:outline-none focus:border-border-muted placeholder:text-text-muted"
            />
            {moduleSearch && (
              <button
                type="button"
                onClick={() => setModuleSearch("")}
                className="absolute right-2 top-1.5 text-xs text-text-muted hover:text-text-base"
              >
                &times;
              </button>
            )}
          </div>

          <nav className="space-y-0.5 max-h-[600px] overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setSelectedModuleId("ALL")}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition text-left min-h-[38px] ${
                selectedModuleId === "ALL"
                  ? "bg-badge-neutral-bg text-text-base font-bold shadow-xs"
                  : "text-text-base hover:bg-surface-sunken"
              }`}
            >
              <span>Semua</span>
              <span className="font-mono text-[11px] text-text-muted">
                {moduleCounts.ALL}
              </span>
            </button>

            {filteredModules.map((m) => {
              const count = moduleCounts[m.id] ?? 0;
              const isSelected = selectedModuleId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModuleId(m.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition text-left min-h-[38px] ${
                    isSelected
                      ? "bg-badge-neutral-bg text-text-base font-bold shadow-xs"
                      : "text-text-base hover:bg-surface-sunken"
                  }`}
                >
                  <span className="truncate" title={m.name}>
                    {m.name}
                  </span>
                  <span className="font-mono text-[11px] text-text-muted ml-2">
                    {count}
                  </span>
                </button>
              );
            })}

            {(moduleCounts.UNASSIGNED > 0 || selectedModuleId === "UNASSIGNED") && (
              <button
                type="button"
                onClick={() => setSelectedModuleId("UNASSIGNED")}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition text-left min-h-[38px] ${
                  selectedModuleId === "UNASSIGNED"
                    ? "bg-badge-neutral-bg text-text-base font-bold shadow-xs"
                    : "text-text-muted hover:bg-surface-sunken italic"
                }`}
              >
                <span>Tanpa modul</span>
                <span className="font-mono text-[11px] text-text-muted">
                  {moduleCounts.UNASSIGNED}
                </span>
              </button>
            )}
          </nav>

          {moduleCounts.UNASSIGNED > 0 && (
            <div className="p-2.5 rounded-lg bg-warn-bg border border-warn-border text-[11px] text-warn leading-relaxed">
              {moduleCounts.UNASSIGNED} test case belum punya modul.
            </div>
          )}
        </aside>

        {/* RIGHT COLUMN: SEARCH, FILTERS & TABLE */}
        <section className="flex-1 min-w-0 w-full space-y-3">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <input
                type="search"
                value={tcSearch}
                onChange={(e) => setTcSearch(e.target.value)}
                placeholder="Cari kode, judul, atau langkah..."
                className="w-full px-3 py-2 text-xs border border-border-base rounded-lg bg-surface-raised focus:outline-none focus:border-border-muted"
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 text-xs border border-border-base rounded-lg bg-surface-raised text-text-base focus:outline-none"
            >
              <option value="ALL">Semua Tipe</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 text-xs border border-border-base rounded-lg bg-surface-raised text-text-base focus:outline-none"
            >
              <option value="ALL">Semua Prioritas</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {(selectedModuleId !== "ALL" || selectedType !== "ALL" || selectedPriority !== "ALL" || tcSearch) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedModuleId("ALL");
                  setSelectedType("ALL");
                  setSelectedPriority("ALL");
                  setTcSearch("");
                }}
                className="text-xs text-link hover:underline font-semibold px-2 py-1"
              >
                Reset filter
              </button>
            )}
          </div>

          {/* Table */}
          {filteredTestCases.length === 0 ? (
            <div className="bg-surface-raised border border-border-base rounded-lg p-10 text-center text-xs text-text-muted">
              Tidak ada test case yang cocok dengan filter yang dipilih.
            </div>
          ) : (
            <div className="bg-surface-raised border border-border-base rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-sunken border-b border-border-base text-text-muted font-bold">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        aria-label="Pilih semua test case di tabel"
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3 w-28">Kode</th>
                    <th className="py-2.5 px-3">Judul Test Case</th>
                    <th className="py-2.5 px-3 w-24">Tipe</th>
                    <th className="py-2.5 px-3 w-24">Prioritas</th>
                    <th className="py-2.5 px-3 w-20">Status</th>
                    {canManage && <th className="py-2.5 px-3 w-20 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base">
                  {filteredTestCases.map((tc) => {
                    const isChecked = selectedIds.has(tc.id);
                    return (
                      <tr
                        key={tc.id}
                        className={`hover:bg-surface-sunken/60 transition ${
                          isChecked ? "bg-link/5" : ""
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(tc.id)}
                            aria-label={`Pilih ${tc.code}`}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-text-base whitespace-nowrap">
                          <Link
                            href={`/projects/${projectKey}/test-cases/${tc.id}`}
                            className="text-link hover:underline"
                          >
                            {tc.code}
                          </Link>
                        </td>
                        <td className="py-3 px-3">
                          <Link
                            href={`/projects/${projectKey}/test-cases/${tc.id}`}
                            className="block font-semibold text-text-base hover:text-link"
                          >
                            {tc.title}
                          </Link>
                          <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                            <span>{tc.moduleName || tc.moduleArea || "Tanpa modul"}</span>
                            {tc.targetRole && <span>• Peran {tc.targetRole}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono text-[11px] text-text-muted">
                            {tc.testType || "Functional"}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-semibold text-text-base capitalize">
                            {tc.priority.toLowerCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {tc.status === "DEPRECATED" ? (
                            <span className="text-[11px] text-text-muted line-through">Usang</span>
                          ) : tc.status === "DRAFT" ? (
                            <span className="text-[11px] text-text-muted">Draf</span>
                          ) : (
                            <span className="text-[11px] text-ok font-semibold">Siap</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <Link
                              href={`/projects/${projectKey}/test-cases/${tc.id}/edit`}
                              className="text-xs text-link hover:underline font-semibold"
                            >
                              Ubah
                            </Link>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Floating Action Bar when items selected (Mockup 23) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ink text-on-ink px-5 py-3 rounded-xl shadow-2xl flex items-center gap-4 text-xs font-semibold">
          <span>{selectedIds.size} dipilih</span>
          <div className="h-4 w-px bg-on-ink/30" />
          {canManage && (
            <button
              type="button"
              onClick={() => setShowMoveModal(true)}
              className="opacity-80 hover:opacity-100 transition"
            >
              Pindah modul
            </button>
          )}
          <Link
            href={`/projects/${projectKey}/test-runs/new?cases=${Array.from(selectedIds).join(",")}`}
            className="bg-action hover:bg-action-hover text-on-action px-3.5 py-1.5 rounded-lg transition"
          >
            Buat test run dari pilihan
          </Link>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="opacity-70 hover:opacity-100"
          >
            Batal
          </button>
        </div>
      )}

      {/* Move Module Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-raised border border-border-base rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-text-base">
              Pindahkan {selectedIds.size} Test Case ke Modul
            </h3>
            {moveError && (
              <div className="p-2.5 bg-bad-bg border border-bad-border rounded text-bad text-xs">
                {moveError}
              </div>
            )}
            <div>
              <label htmlFor="targetModule" className="block text-xs font-bold text-text-base mb-1">
                Pilih Modul Tujuan
              </label>
              <select
                id="targetModule"
                value={targetMoveModuleId}
                onChange={(e) => setTargetMoveModuleId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-border-base rounded-lg bg-surface-sunken text-text-base focus:outline-none"
              >
                <option value="">Tanpa modul</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-base rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={moving}
                onClick={handleBulkMove}
                className="px-4 py-1.5 text-xs font-bold text-on-action bg-action hover:bg-action-hover rounded-lg disabled:opacity-50"
              >
                {moving ? "Memindahkan..." : "Pindahkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
