"use client";

import { useState } from "react";
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
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Test Case Repository</h2>
          <p className="text-xs text-slate-500">
            Total {testCases.length} skenario pengujian terdaftar. Klik baris untuk detail & langkah uji.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="press-snappy px-3 py-1.5 bg-action hover:bg-action-hover text-white text-xs font-semibold rounded shadow-xs"
            >
              + Test Case Baru
            </button>
          </div>
        )}
      </div>

      {testCases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-500">
          Belum ada test case di project ini. Klik tombol <strong>+ Test Case Baru</strong> atau impor spreadsheet Excel/CSV.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Area / Modul</th>
                <th className="py-3 px-4">Judul Test Case</th>
                <th className="py-3 px-4">Prioritas</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Expected Result</th>
                {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {testCases.map((tc) => (
                <tr
                  key={tc.id}
                  onClick={() => openView(tc)}
                  className="hover:bg-slate-50 transition-colors duration-100 cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {tc.code}
                  </td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                    {tc.moduleName ?? (tc.moduleArea ? `${tc.moduleArea} (manual)` : "-")}
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(tc)}
                          className="text-action hover:underline font-medium text-xs"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW MODAL */}
      {activeModal === "view" && selectedTc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col chat-in">
            <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                  {selectedTc.code}
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
                      defaultValue={selectedTc?.moduleId || ""}
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
                      defaultValue={selectedTc?.testType || "Functional"}
                      placeholder="Functional, Negative, UI, Security, dsb"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                    />
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
    </>
  );
}
