"use client";

import { useState, useMemo } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { upsertSingleTestCase, deleteSingleTestCase } from "./test-case-actions";

export type TestCaseItem = {
  id: string;
  code: string;
  title: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
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

const KNOWN_TYPES = ["Functional", "E2E", "Integration", "Smoke", "Regression", "Negative", "UI", "Security", "Performance"];

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
  const [activeModal, setActiveModal] = useState<"create" | "view" | "edit" | null>(null);
  const [selectedTc, setSelectedTc] = useState<TestCaseItem | null>(null);

  // Filters state
  const [selectedModuleId, setSelectedModuleId] = useState<string | "ALL" | "UNASSIGNED">("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [moduleSearch, setModuleSearch] = useState<string>("");
  const [tcSearch, setTcSearch] = useState<string>("");

  // Calculate counts per module
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

  // Extract all distinct test types from data + standard known types
  const availableTypes = useMemo(() => {
    const set = new Set<string>(KNOWN_TYPES);
    for (const tc of testCases) {
      if (tc.testType?.trim()) set.add(tc.testType.trim());
    }
    return Array.from(set);
  }, [testCases]);

  // Filtered module list for the left sidebar
  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) => m.name.toLowerCase().includes(q));
  }, [modules, moduleSearch]);

  // Filtered test cases for the right table
  const filteredTestCases = useMemo(() => {
    return testCases.filter((tc) => {
      // Module filter
      if (selectedModuleId === "UNASSIGNED") {
        if (tc.moduleId !== null) return false;
      } else if (selectedModuleId !== "ALL") {
        if (tc.moduleId !== selectedModuleId) return false;
      }

      // Type filter
      if (selectedType !== "ALL") {
        const typeNormalized = (tc.testType || "Functional").trim().toLowerCase();
        if (typeNormalized !== selectedType.toLowerCase()) return false;
      }

      // Text search in title or code
      if (tcSearch.trim()) {
        const q = tcSearch.toLowerCase().trim();
        const codeMatch = tc.code.toLowerCase().includes(q);
        const titleMatch = tc.title.toLowerCase().includes(q);
        const stepsMatch = tc.steps.toLowerCase().includes(q);
        if (!codeMatch && !titleMatch && !stepsMatch) return false;
      }

      return true;
    });
  }, [testCases, selectedModuleId, selectedType, tcSearch]);

  // Current active module metadata
  const currentModuleName = useMemo(() => {
    if (selectedModuleId === "ALL") return "Semua Modul";
    if (selectedModuleId === "UNASSIGNED") return "Tanpa Modul / Belum Diassign";
    const found = modules.find((m) => m.id === selectedModuleId);
    return found ? found.name : "Modul Tidak Dikenal";
  }, [selectedModuleId, modules]);

  function openCreate() {
    setSelectedTc(null);
    setActiveModal("create");
  }

  function openView(tc: TestCaseItem) {
    setSelectedTc(tc);
    setActiveModal("view");
  }

  function openEdit(tc: TestCaseItem) {
    setSelectedTc(tc);
    setActiveModal("edit");
  }

  function closeModal() {
    setActiveModal(null);
    setSelectedTc(null);
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Test Case Repository</h2>
          <p className="text-xs text-slate-500">
            Total {testCases.length} skenario pengujian. Pilih modul di sisi kiri untuk navigasi cepat.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="press-snappy px-3.5 py-1.5 bg-action hover:bg-action-hover text-white text-xs font-semibold rounded shadow-xs"
          >
            + Test Case Baru
          </button>
        )}
      </div>

      {/* Two-Column Master-Detail Layout */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* LEFT COLUMN: MODULE SIDEBAR */}
        <aside className="w-full lg:w-64 bg-white border border-slate-200 rounded-lg p-3 shadow-xs shrink-0 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Modul Fitur</span>
            <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {modules.length}
            </span>
          </div>

          {/* Module Mini Search */}
          <div className="relative">
            <input
              type="text"
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              placeholder="Cari modul..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-slate-50/60 focus:bg-white focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
            />
            {moduleSearch && (
              <button
                type="button"
                onClick={() => setModuleSearch("")}
                className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            )}
          </div>

          {/* Module Navigation List */}
          <nav className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {/* All Modules option */}
            <button
              type="button"
              onClick={() => setSelectedModuleId("ALL")}
              className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded transition-colors text-left ${
                selectedModuleId === "ALL"
                  ? "bg-slate-900 text-white font-semibold"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="truncate">Semua Test Case</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  selectedModuleId === "ALL"
                    ? "bg-slate-800 text-slate-200"
                    : "bg-slate-100 text-slate-600 font-medium"
                }`}
              >
                {moduleCounts.ALL}
              </span>
            </button>

            {/* List of custom modules */}
            {filteredModules.map((m) => {
              const count = moduleCounts[m.id] ?? 0;
              const isSelected = selectedModuleId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModuleId(m.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded transition-colors text-left ${
                    isSelected
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate" title={m.name}>
                    {m.name}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                      isSelected
                        ? "bg-slate-800 text-slate-200"
                        : "bg-slate-100 text-slate-600 font-medium"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Unassigned Module option */}
            {(moduleCounts.UNASSIGNED > 0 || selectedModuleId === "UNASSIGNED") && (
              <button
                type="button"
                onClick={() => setSelectedModuleId("UNASSIGNED")}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded transition-colors text-left ${
                  selectedModuleId === "UNASSIGNED"
                    ? "bg-slate-900 text-white font-semibold"
                    : "text-slate-500 hover:bg-slate-100 italic"
                }`}
              >
                <span className="truncate">Tanpa Modul</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    selectedModuleId === "UNASSIGNED"
                      ? "bg-slate-800 text-slate-200"
                      : "bg-slate-100 text-slate-600 font-medium"
                  }`}
                >
                  {moduleCounts.UNASSIGNED}
                </span>
              </button>
            )}

            {filteredModules.length === 0 && moduleSearch && (
              <p className="text-[11px] text-slate-400 p-2 text-center">Modul tidak ditemukan.</p>
            )}
          </nav>
        </aside>

        {/* RIGHT COLUMN: FILTER BAR & TEST CASE TABLE */}
        <section className="flex-1 w-full space-y-3">
          {/* Active Module Header & Sub-Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{currentModuleName}</h3>
                <span className="text-xs text-slate-500 font-mono">
                  ({filteredTestCases.length} skenario)
                </span>
              </div>
            </div>

            {/* Filter controls: Search and Type Pills */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Type Filter Select */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Tipe:</span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-700 font-medium focus:outline-none focus:border-slate-400"
                >
                  <option value="ALL">Semua Tipe</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* In-Module Text Search */}
              <div className="relative">
                <input
                  type="text"
                  value={tcSearch}
                  onChange={(e) => setTcSearch(e.target.value)}
                  placeholder="Cari kode atau judul..."
                  className="w-48 sm:w-56 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
                />
                {tcSearch && (
                  <button
                    type="button"
                    onClick={() => setTcSearch("")}
                    className="absolute right-2 top-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table list */}
          {filteredTestCases.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-xs text-slate-500 space-y-2">
              <p>Tidak ada test case yang cocok dengan filter yang dipilih.</p>
              {(selectedModuleId !== "ALL" || selectedType !== "ALL" || tcSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModuleId("ALL");
                    setSelectedType("ALL");
                    setTcSearch("");
                  }}
                  className="text-action underline text-xs font-semibold"
                >
                  Reset semua filter
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Tipe</th>
                    <th className="py-3 px-4">Judul Test Case</th>
                    <th className="py-3 px-4">Prioritas</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Expected Result</th>
                    {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTestCases.map((tc) => (
                    <tr
                      key={tc.id}
                      onClick={() => openView(tc)}
                      className="hover:bg-slate-50 transition-colors duration-100 cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {tc.code}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 font-medium">
                          {tc.testType || "Functional"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {tc.title}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            tc.priority === "CRITICAL"
                              ? "bg-red-100 text-red-700"
                              : tc.priority === "HIGH"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {tc.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {tc.targetRole || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {tc.expectedResult}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openEdit(tc)}
                            className="text-action hover:underline font-medium text-xs"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* VIEW MODAL */}
      {activeModal === "view" && selectedTc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col chat-in">
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                  {selectedTc.code}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                  {selectedTc.testType || "Functional"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    selectedTc.priority === "CRITICAL"
                      ? "bg-red-100 text-red-700"
                      : selectedTc.priority === "HIGH"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {selectedTc.priority}
                </span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none"
              >
                &times;
              </button>
            </header>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{selectedTc.title}</h3>
                <div className="flex flex-wrap gap-4 text-slate-500 text-xs">
                  <div>Modul: <strong className="text-slate-700">{selectedTc.moduleName || selectedTc.moduleArea || "-"}</strong></div>
                  <div>Tipe: <strong className="text-slate-700">{selectedTc.testType || "Functional"}</strong></div>
                  <div>Aktor / Role: <strong className="text-slate-700">{selectedTc.targetRole || "-"}</strong></div>
                </div>
              </div>

              {selectedTc.referenceUrl && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">Tautan Referensi (Figma/Doc):</span>
                  <a
                    href={selectedTc.referenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-action underline font-mono break-all"
                  >
                    {selectedTc.referenceUrl}
                  </a>
                </div>
              )}

              {selectedTc.precondition && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <span className="font-semibold text-slate-700 block mb-1">Prasyarat (Preconditions):</span>
                  <p className="text-slate-800 whitespace-pre-wrap">{selectedTc.precondition}</p>
                </div>
              )}

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Langkah Pengujian (Steps):</span>
                <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                  {selectedTc.steps}
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Hasil yang Diharapkan (Expected Result):</span>
                <div className="bg-emerald-50/50 border border-emerald-200 rounded p-3 text-emerald-950 font-medium whitespace-pre-wrap">
                  {selectedTc.expectedResult}
                </div>
              </div>
            </div>

            <footer className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-lg">
              <div>
                {canManage && (
                  <ActionForm
                    action={async (prev, fd) => {
                      const res = await deleteSingleTestCase(projectId, projectKey, prev, fd);
                      if (res && "ok" in res && res.ok) closeModal();
                      return res;
                    }}
                  >
                    <input type="hidden" name="id" value={selectedTc.id} />
                    <SubmitButton pendingText="Menghapus..." className="press-snappy px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold">
                      Hapus Test Case
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="press-snappy px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Tutup
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setActiveModal("edit")}
                    className="press-snappy px-3 py-1.5 text-xs font-semibold rounded bg-action hover:bg-action-hover text-white"
                  >
                    Edit Test Case
                  </button>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* CREATE & EDIT MODAL */}
      {(activeModal === "create" || activeModal === "edit") && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col chat-in">
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {activeModal === "create" ? "Buat Test Case Baru" : `Edit Test Case ${selectedTc?.code}`}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none"
              >
                &times;
              </button>
            </header>

            <ActionForm
              action={async (prev, fd) => {
                const res = await upsertSingleTestCase(projectId, projectKey, prev, fd);
                if (res && "ok" in res && res.ok) closeModal();
                return res;
              }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              {activeModal === "edit" && selectedTc && (
                <input type="hidden" name="id" value={selectedTc.id} />
              )}

              <div className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Kode (Opsional)
                    </label>
                    <input
                      name="code"
                      defaultValue={selectedTc?.code || ""}
                      placeholder="e.g. TC-AUTH-001"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs uppercase"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Kosongkan untuk auto-code</p>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Modul / Area
                    </label>
                    <select
                      name="moduleId"
                      defaultValue={
                        selectedTc?.moduleId ||
                        (selectedModuleId !== "ALL" && selectedModuleId !== "UNASSIGNED"
                          ? selectedModuleId
                          : "")
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="">-- Tanpa Modul --</option>
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Prioritas *
                    </label>
                    <select
                      name="priority"
                      defaultValue={selectedTc?.priority || "MEDIUM"}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Judul Skenario Test Case *
                  </label>
                  <input
                    name="title"
                    required
                    defaultValue={selectedTc?.title || ""}
                    placeholder="Contoh: Verifikasi validasi format nomor WhatsApp saat registrasi"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Tipe Pengujian (Opsional)
                    </label>
                    <input
                      name="testType"
                      list="test-types-datalist"
                      defaultValue={selectedTc?.testType || (selectedType !== "ALL" ? selectedType : "Functional")}
                      placeholder="Functional, E2E, Regression, UI, dsb"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                    />
                    <datalist id="test-types-datalist">
                      {availableTypes.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Target Role / Aktor (Opsional)
                    </label>
                    <input
                      name="targetRole"
                      defaultValue={selectedTc?.targetRole || ""}
                      placeholder="Admin, Marketing, Pasien, dsb"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Prasyarat (Preconditions)
                  </label>
                  <input
                    name="precondition"
                    defaultValue={selectedTc?.precondition || ""}
                    placeholder="Contoh: User sudah login dengan akun role Staf Gudang"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Langkah-langkah Pengujian (Steps) *
                  </label>
                  <textarea
                    name="steps"
                    rows={4}
                    required
                    defaultValue={selectedTc?.steps || ""}
                    placeholder="1. Buka menu Pengaturan > Pengguna&#10;2. Klik tombol Tambah Pengguna&#10;3. Masukkan nomor HP tanpa kode negara"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Hasil yang Diharapkan (Expected Result) *
                  </label>
                  <textarea
                    name="expectedResult"
                    rows={2}
                    required
                    defaultValue={selectedTc?.expectedResult || ""}
                    placeholder="Contoh: Muncul pesan error 'Nomor telepon harus diawali 08 atau +62'"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Link Referensi Figma / PRD (Opsional)
                  </label>
                  <input
                    name="referenceUrl"
                    type="url"
                    defaultValue={selectedTc?.referenceUrl || ""}
                    placeholder="https://figma.com/file/... atau link dokumen"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <footer className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50 rounded-b-lg">
                <button
                  type="button"
                  onClick={closeModal}
                  className="press-snappy px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <SubmitButton
                  pendingText="Menyimpan..."
                  className="press-snappy px-4 py-1.5 text-xs font-semibold rounded bg-action hover:bg-action-hover text-white"
                >
                  Simpan Test Case
                </SubmitButton>
              </footer>
            </ActionForm>
          </div>
        </div>
      )}
    </div>
  );
}
