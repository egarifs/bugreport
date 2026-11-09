"use client";

import { useState } from "react";
import Link from "next/link";
import type { TestCasePriority, TestCaseStatus } from "@prisma/client";
import { createTestCaseAction, updateTestCaseAction } from "./test-case-actions";

type ModuleOption = { id: string; name: string };

interface TestCaseFormProps {
  projectId: string;
  projectKey: string;
  modules: ModuleOption[];
  initialData?: {
    id: string;
    code: string;
    title: string;
    moduleId: string | null;
    priority: TestCasePriority;
    status: TestCaseStatus;
    testType: string | null;
    targetRole: string | null;
    precondition: string | null;
    steps: string;
    expectedResult: string;
    referenceUrl: string | null;
    version?: number;
  };
}

function parseStepsToLines(stepsStr?: string): string[] {
  if (!stepsStr) return [""];
  const lines = stepsStr
    .split(/\r?\n/)
    .map((l) => l.replace(/^\d+[\).\s-]+\s*/, "").trim())
    .filter((l) => l.length > 0);
  return lines.length > 0 ? lines : [""];
}

function serializeLinesToSteps(lines: string[]): string {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  return clean.map((step, idx) => `${idx + 1}) ${step}`).join("\n");
}

export function TestCaseForm({
  projectId,
  projectKey,
  modules,
  initialData,
}: TestCaseFormProps) {
  const isEditing = Boolean(initialData?.id);

  const [code, setCode] = useState(initialData?.code || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [moduleId, setModuleId] = useState(initialData?.moduleId || "");
  const [priority, setPriority] = useState<TestCasePriority>(initialData?.priority || "HIGH");
  const [status, setStatus] = useState<TestCaseStatus>(initialData?.status || "READY");
  const [testType, setTestType] = useState(initialData?.testType || "Functional");
  const [targetRole, setTargetRole] = useState(initialData?.targetRole || "");
  const [precondition, setPrecondition] = useState(initialData?.precondition || "");
  const [stepsList, setStepsList] = useState<string[]>(parseStepsToLines(initialData?.steps));
  const [expectedResult, setExpectedResult] = useState(initialData?.expectedResult || "");
  const [referenceUrl, setReferenceUrl] = useState(initialData?.referenceUrl || "");
  const [changelog, setChangelog] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleStepChange(index: number, value: string) {
    const updated = [...stepsList];
    updated[index] = value;
    setStepsList(updated);
  }

  function handleAddStep() {
    setStepsList([...stepsList, ""]);
  }

  function handleRemoveStep(index: number) {
    if (stepsList.length <= 1) {
      setStepsList([""]);
      return;
    }
    setStepsList(stepsList.filter((_, i) => i !== index));
  }

  async function handleSubmit(saveAndCreateAnother: boolean = false) {
    setError(null);
    if (!title.trim()) {
      setError("Judul test case wajib diisi.");
      return;
    }
    const serializedSteps = serializeLinesToSteps(stepsList);
    if (!serializedSteps.trim()) {
      setError("Langkah-langkah pengujian wajib diisi.");
      return;
    }
    if (!expectedResult.trim()) {
      setError("Hasil yang diharapkan wajib diisi.");
      return;
    }
    if (isEditing && !changelog.trim()) {
      setError("Catatan perubahan wajib diisi untuk versi baru.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.set("code", code);
    formData.set("title", title);
    if (moduleId) formData.set("moduleId", moduleId);
    formData.set("priority", priority);
    formData.set("status", status);
    if (testType) formData.set("testType", testType);
    if (targetRole) formData.set("targetRole", targetRole);
    if (precondition) formData.set("precondition", precondition);
    formData.set("steps", serializedSteps);
    formData.set("expectedResult", expectedResult);
    if (referenceUrl) formData.set("referenceUrl", referenceUrl);
    if (isEditing && changelog) formData.set("changelog", changelog);

    let res;
    if (isEditing && initialData?.id) {
      res = await updateTestCaseAction(projectId, projectKey, initialData.id, {}, formData);
    } else {
      res = await createTestCaseAction(projectId, projectKey, {}, formData);
    }
    setLoading(false);

    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }

    if (saveAndCreateAnother) {
      setTitle("");
      setPrecondition("");
      setStepsList([""]);
      setExpectedResult("");
      setReferenceUrl("");
      setChangelog("");
      setError(null);
    } else if (res && "id" in res && res.id) {
      window.location.assign(`/projects/${projectKey}/test-cases/${res.id}`);
    } else if (initialData?.id) {
      window.location.assign(`/projects/${projectKey}/test-cases/${initialData.id}`);
    } else {
      setError("Test case tersimpan, tetapi ID tidak diterima. Muat ulang repository untuk membukanya.");
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-surface-base">
      <header className="px-6 py-3.5 border-b border-border-base flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs text-text-muted">
            <Link href={`/projects/${projectKey}/test-cases`} className="text-link hover:underline">
              Test case
            </Link>{" "}
            / {isEditing ? `Ubah ${initialData?.code || ""}` : "Baru"}
          </div>
          <h1 className="text-xl font-bold text-text-base mt-0.5">
            {isEditing ? `Ubah test case (${initialData?.code})` : "Tambah test case"}
          </h1>
        </div>
        {isEditing && (
          <div className="text-xs text-text-muted flex items-center gap-1.5">
            <span className="font-mono font-medium bg-badge-neutral-bg text-badge-neutral-text px-2 py-0.5 rounded">
              Versi saat ini: v{initialData?.version || 1}
            </span>
          </div>
        )}
      </header>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-bad-bg border border-bad-border text-bad text-xs rounded-lg">
          {error}
        </div>
      )}

      <div className="p-6 flex-1 overflow-auto max-w-4xl space-y-4">
        {/* Row 1: Code & Title */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="code" className="block text-xs font-bold text-text-base mb-1">
              Kode
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Otomatis"
              className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised font-mono text-xs text-text-base focus:ring-1 focus:ring-link outline-none"
            />
            <span className="text-[11px] text-text-muted mt-1 block">
              Kosongkan untuk penomoran otomatis
            </span>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="title" className="block text-xs font-bold text-text-base mb-1">
              Judul <span className="text-bad">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Sales tidak bisa membuka kontak milik sales lain lewat URL"
              className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
              required
            />
          </div>
        </div>

        {/* Row 2: Modul, Priority, Status, Type, Target Role */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="moduleId" className="block text-xs font-bold text-text-base mb-1">
              Modul
            </label>
            <select
              id="moduleId"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
            >
              <option value="">Tanpa modul</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-bold text-text-base mb-1">Prioritas</span>
            <div className="flex rounded-lg bg-surface-sunken p-1 border border-border-base gap-1">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as TestCasePriority[]).map((p) => {
                const isActive = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1 text-xs font-bold rounded capitalize transition ${
                      isActive
                        ? "bg-surface-raised text-text-base shadow-sm"
                        : "text-text-muted hover:text-text-base"
                    }`}
                  >
                    {p.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-xs font-bold text-text-base mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TestCaseStatus)}
              className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
            >
              <option value="READY">Siap (Ready)</option>
              <option value="DRAFT">Draf (Draft)</option>
              <option value="DEPRECATED">Usang (Deprecated)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="testType" className="block text-xs font-bold text-text-base mb-1">
              Tipe Pengujian
            </label>
            <input
              id="testType"
              type="text"
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              placeholder="Functional, Negative, Security, UI..."
              className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
            />
          </div>

          <div>
            <label htmlFor="targetRole" className="block text-xs font-bold text-text-base mb-1">
              Peran Target
            </label>
            <input
              id="targetRole"
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Sales, Admin, Finance, Pasien..."
              className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
            />
          </div>
        </div>

        {/* Row 3: Precondition */}
        <div>
          <label htmlFor="precondition" className="block text-xs font-bold text-text-base mb-1">
            Prasyarat
          </label>
          <input
            id="precondition"
            type="text"
            value={precondition}
            onChange={(e) => setPrecondition(e.target.value)}
            placeholder="Contoh: Ada 2 akun Sales di tim berbeda, masing-masing punya minimal 1 kontak"
            className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
          />
        </div>

        {/* Row 4: Steps */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-text-base">
              Langkah-langkah Pengujian <span className="text-bad">*</span>
            </span>
            <span className="text-[11px] text-text-muted">
              Masukkan langkah pengujian terurut
            </span>
          </div>

          <div className="space-y-2">
            {stepsList.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-6 font-mono text-xs font-bold text-text-muted text-right">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => handleStepChange(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddStep();
                    }
                  }}
                  placeholder={`Langkah ${idx + 1}`}
                  className="flex-1 px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveStep(idx)}
                  className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-bad rounded transition"
                  aria-label={`Hapus langkah ${idx + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddStep}
            className="mt-2 text-xs font-bold text-link hover:underline pl-8"
          >
            + Tambah langkah
          </button>
        </div>

        {/* Row 5: Expected Result */}
        <div>
          <label htmlFor="expectedResult" className="block text-xs font-bold text-text-base mb-1">
            Hasil yang Diharapkan <span className="text-bad">*</span>
          </label>
          <textarea
            id="expectedResult"
            rows={3}
            value={expectedResult}
            onChange={(e) => setExpectedResult(e.target.value)}
            placeholder="Contoh: Kontak milik sales lain tidak muncul di pencarian. URL langsung menampilkan halaman 'Tidak punya akses'."
            className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none resize-none"
            required
          />
        </div>

        {/* Row 6: Reference URL */}
        <div>
          <label htmlFor="referenceUrl" className="block text-xs font-bold text-text-base mb-1">
            Link Referensi (Figma / Dokumen)
          </label>
          <input
            id="referenceUrl"
            type="url"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-border-base rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
          />
        </div>

        {/* Edit mode: Changelog */}
        {isEditing && (
          <div className="p-3.5 bg-warn-bg border border-warn-border rounded-lg">
            <label htmlFor="changelog" className="block text-xs font-bold text-warn mb-1">
              Catatan Perubahan (Wajib untuk Versi Baru) <span className="text-bad">*</span>
            </label>
            <input
              id="changelog"
              type="text"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="Contoh: Tambah langkah buka URL langsung dan perjelas ekspektasi error"
              className="w-full px-3 py-2 border border-warn-border rounded-lg bg-surface-raised text-sm text-text-base focus:ring-1 focus:ring-link outline-none"
              required
            />
            <span className="text-[11px] text-warn mt-1 block">
              Setiap kali test case diubah, versi baru (v{(initialData?.version || 1) + 1}) dibuat dengan catatan perubahan ini.
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <footer className="border-t border-border-base bg-surface-raised px-6 py-3 flex items-center justify-between">
        <span className="text-xs text-text-muted">
          Pastikan semua kolom bertanda bintang terisi
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={
              isEditing && initialData?.id
                ? `/projects/${projectKey}/test-cases/${initialData.id}`
                : `/projects/${projectKey}/test-cases`
            }
            className="px-3.5 py-2 text-xs font-medium text-text-base border border-transparent hover:bg-surface-sunken rounded-lg transition min-h-[44px] flex items-center"
          >
            Batal
          </Link>
          {!isEditing && (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 text-xs font-semibold text-text-base border border-border-base hover:bg-surface-sunken rounded-lg transition min-h-[44px] flex items-center disabled:opacity-50"
            >
              Simpan & buat lagi
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit(false)}
            className="px-5 py-2 text-xs font-bold text-white bg-link hover:bg-link/90 rounded-lg shadow-sm transition min-h-[44px] flex items-center disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan"}
          </button>
        </div>
      </footer>
    </div>
  );
}
