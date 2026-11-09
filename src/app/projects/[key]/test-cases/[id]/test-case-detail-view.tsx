"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TestCasePriority, TestCaseStatus, TestRunItemStatus } from "@prisma/client";
import { toggleTestCaseStatusAction } from "../test-case-actions";

type VersionItem = {
  id: string;
  version: number;
  changelog: string | null;
  snapshot: any;
  createdAt: Date | string;
  createdBy: { id: string; name: string | null; email: string | null } | null;
};

type RunItemHistory = {
  id: string;
  status: TestRunItemStatus;
  notes: string | null;
  actualResult: string | null;
  executedAt: Date | string | null;
  executedBy: { id: string; name: string | null; email: string | null } | null;
  testRun: {
    id: string;
    name: string;
    environment: string;
    createdAt: Date | string;
  };
  createdBug: {
    id: string;
    key: string;
    number: number;
    title: string;
    status: string;
  } | null;
};

interface TestCaseDetailProps {
  projectId: string;
  projectKey: string;
  canManage: boolean;
  testCase: {
    id: string;
    code: string;
    title: string;
    priority: TestCasePriority;
    status: TestCaseStatus;
    testType: string | null;
    targetRole: string | null;
    precondition: string | null;
    steps: string;
    expectedResult: string;
    referenceUrl: string | null;
    module: { id: string; name: string } | null;
    versions: VersionItem[];
    runItems: RunItemHistory[];
  };
}

function renderStatusBadge(status: TestCaseStatus) {
  if (status === "READY") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-ok-bg text-ok border border-ok-border">
        Siap
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-badge-neutral-bg text-badge-neutral-text">
        Draf
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-surface-sunken text-text-muted border border-border-base line-through">
      Usang
    </span>
  );
}

function renderRunResult(status: TestRunItemStatus) {
  switch (status) {
    case "PASS":
      return (
        <span className="inline-flex items-center gap-1.5 font-bold text-xs text-ok">
          <svg className="w-3.5 h-3.5 fill-ok" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="6" />
            <path d="M4.5 7.2 6.2 9 9.5 5.5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
          Lolos
        </span>
      );
    case "FAIL":
      return (
        <span className="inline-flex items-center gap-1.5 font-bold text-xs text-bad">
          <svg className="w-3.5 h-3.5 fill-bad" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="6" />
            <path d="M5 5l4 4M9 5l-4 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Gagal
        </span>
      );
    case "BLOCKED":
      return (
        <span className="inline-flex items-center gap-1.5 font-bold text-xs text-warn">
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 7h6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Terblokir
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted font-medium">
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2.5" />
          </svg>
          Belum dijalankan
        </span>
      );
  }
}

export function TestCaseDetailView({
  projectId,
  projectKey,
  canManage,
  testCase,
}: TestCaseDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"detail" | "history" | "versions" | "bugs">("detail");
  const [comparingVersion, setComparingVersion] = useState<number | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const currentVersion = testCase.versions[0]?.version || 1;
  const totalRuns = testCase.runItems.length;
  const passCount = testCase.runItems.filter((i) => i.status === "PASS").length;
  const failCount = testCase.runItems.filter((i) => i.status === "FAIL").length;
  const lastRun = testCase.runItems[0];

  // Unique linked bugs
  const linkedBugs = Array.from(
    new Map(
      testCase.runItems
        .filter((i) => i.createdBug)
        .map((i) => [i.createdBug!.id, i.createdBug!])
    ).values()
  );

  async function handleToggleStatus() {
    if (!canManage) return;
    setTogglingStatus(true);
    const nextStatus: TestCaseStatus = testCase.status === "DEPRECATED" ? "READY" : "DEPRECATED";
    await toggleTestCaseStatusAction(projectId, projectKey, testCase.id, nextStatus);
    setTogglingStatus(false);
    router.refresh();
  }

  // Parse steps to array
  const stepsLines = testCase.steps
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col flex-1 bg-surface-base min-h-0 overflow-auto">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border-base bg-surface-raised flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-text-muted mb-1">
            <Link href={`/projects/${projectKey}/test-cases`} className="text-link hover:underline">
              Test case
            </Link>{" "}
            / {testCase.module?.name || "Tanpa modul"}
          </div>

          <h1 className="text-xl font-bold text-text-base flex items-baseline gap-2 flex-wrap">
            <span className="font-mono font-medium text-text-muted">{testCase.code}</span>
            <span>{testCase.title}</span>
          </h1>

          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-text-muted">
            {renderStatusBadge(testCase.status)}
            <span className="font-mono font-semibold text-text-base">Versi {currentVersion}</span>
            <span>•</span>
            <span className="font-medium text-text-base capitalize">
              {testCase.priority.toLowerCase()}
            </span>
            {testCase.testType && (
              <>
                <span>•</span>
                <span>{testCase.testType}</span>
              </>
            )}
            {testCase.targetRole && (
              <>
                <span>•</span>
                <span>Peran {testCase.targetRole}</span>
              </>
            )}
            {testCase.referenceUrl && (
              <>
                <span>•</span>
                <a
                  href={testCase.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link hover:underline inline-flex items-center gap-1"
                >
                  Referensi ↗
                </a>
              </>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={togglingStatus}
              onClick={handleToggleStatus}
              className="px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-base hover:bg-surface-sunken rounded-lg transition min-h-[36px]"
            >
              {togglingStatus
                ? "Menyimpan..."
                : testCase.status === "DEPRECATED"
                ? "Aktifkan kembali"
                : "Tandai usang"}
            </button>
            <Link
              href={`/projects/${projectKey}/test-cases/${testCase.id}/edit`}
              className="px-3.5 py-1.5 text-xs font-semibold text-text-base border border-border-base bg-surface-raised hover:bg-surface-sunken rounded-lg transition min-h-[36px] flex items-center"
            >
              Ubah
            </Link>
          </div>
        )}
      </header>

      {/* Tabs */}
      <nav className="flex items-center gap-1 px-6 border-b border-border-base bg-surface-raised text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("detail")}
          className={`py-3 px-3 border-b-2 transition ${
            activeTab === "detail"
              ? "border-link text-link"
              : "border-transparent text-text-muted hover:text-text-base"
          }`}
        >
          Detail
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
            activeTab === "history"
              ? "border-link text-link"
              : "border-transparent text-text-muted hover:text-text-base"
          }`}
        >
          Riwayat eksekusi
          <span className="font-mono text-[11px] font-normal px-1.5 py-0.2 rounded-full bg-surface-sunken text-text-muted">
            {totalRuns}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("versions")}
          className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
            activeTab === "versions"
              ? "border-link text-link"
              : "border-transparent text-text-muted hover:text-text-base"
          }`}
        >
          Versi
          <span className="font-mono text-[11px] font-normal px-1.5 py-0.2 rounded-full bg-surface-sunken text-text-muted">
            {testCase.versions.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bugs")}
          className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
            activeTab === "bugs"
              ? "border-link text-link"
              : "border-transparent text-text-muted hover:text-text-base"
          }`}
        >
          Bug terkait
          <span className="font-mono text-[11px] font-normal px-1.5 py-0.2 rounded-full bg-surface-sunken text-text-muted">
            {linkedBugs.length}
          </span>
        </button>
      </nav>

      {/* Tab Contents */}
      <div className="flex-1 p-6 max-w-5xl">
        {activeTab === "detail" && (
          <div className="space-y-6">
            {testCase.precondition && (
              <div className="p-4 bg-surface-raised border border-border-base rounded-lg">
                <span className="block text-xs font-bold text-text-muted mb-1">Prasyarat</span>
                <p className="text-sm text-text-base">{testCase.precondition}</p>
              </div>
            )}

            <div>
              <span className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Langkah-langkah Pengujian
              </span>
              <div className="space-y-2">
                {stepsLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-surface-raised border border-border-base rounded-lg text-sm text-text-base"
                  >
                    <span className="font-mono font-bold text-xs text-text-muted mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="flex-1 leading-relaxed">
                      {line.replace(/^\d+[\).\s-]+\s*/, "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Hasil yang Diharapkan
              </span>
              <div className="p-4 bg-ok-bg/30 border border-ok-border rounded-lg text-sm text-text-base leading-relaxed">
                {testCase.expectedResult}
              </div>
            </div>

            {testCase.referenceUrl && (
              <div>
                <span className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Referensi
                </span>
                <a
                  href={testCase.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-link hover:underline font-mono"
                >
                  {testCase.referenceUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-surface-raised border border-border-base rounded-lg">
                <span className="text-xl font-bold text-text-base block">{totalRuns}</span>
                <span className="text-xs text-text-muted">Total percobaan</span>
              </div>
              <div className="p-3 bg-surface-raised border border-border-base rounded-lg">
                <span className="text-xl font-bold text-ok block">{passCount}</span>
                <span className="text-xs text-text-muted">Lolos</span>
              </div>
              <div className="p-3 bg-surface-raised border border-border-base rounded-lg">
                <span className="text-xl font-bold text-bad block">{failCount}</span>
                <span className="text-xs text-text-muted">Gagal</span>
              </div>
              <div className="p-3 bg-surface-raised border border-border-base rounded-lg">
                <span className="text-sm font-bold text-text-base block truncate">
                  {lastRun ? renderRunResult(lastRun.status) : "—"}
                </span>
                <span className="text-xs text-text-muted">Terakhir dieksekusi</span>
              </div>
            </div>

            {/* Run history table */}
            {testCase.runItems.length === 0 ? (
              <div className="p-8 text-center bg-surface-raised border border-border-base rounded-lg text-xs text-text-muted">
                Belum pernah dieksekusi dalam test run manapun.
              </div>
            ) : (
              <div className="border border-border-base rounded-lg bg-surface-raised overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken border-b border-border-base text-text-muted font-bold">
                    <tr>
                      <th className="px-4 py-2.5">Waktu</th>
                      <th className="px-4 py-2.5">Test Run</th>
                      <th className="px-4 py-2.5">Lingkungan</th>
                      <th className="px-4 py-2.5">Penguji</th>
                      <th className="px-4 py-2.5">Hasil</th>
                      <th className="px-4 py-2.5">Bug / Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-base">
                    {testCase.runItems.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-sunken/50 transition">
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                          {item.executedAt
                            ? new Date(item.executedAt).toLocaleString("id-ID", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : new Date(item.testRun.createdAt).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-text-base">
                          <Link
                            href={`/projects/${projectKey}/test-runs/${item.testRun.id}`}
                            className="text-link hover:underline"
                          >
                            {item.testRun.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-text-muted">{item.testRun.environment}</td>
                        <td className="px-4 py-3 text-text-base">
                          {item.executedBy?.name || item.executedBy?.email || "—"}
                        </td>
                        <td className="px-4 py-3">{renderRunResult(item.status)}</td>
                        <td className="px-4 py-3 text-text-muted">
                          {item.createdBug ? (
                            <Link
                              href={`/projects/${projectKey}/bugs/${item.createdBug.number}`}
                              className="inline-flex items-center gap-1 font-mono text-link hover:underline font-bold"
                            >
                              {item.createdBug.key}
                            </Link>
                          ) : (
                            item.notes || "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "versions" && (
          <div className="space-y-4">
            <div className="text-xs text-text-muted">
              Riwayat versi test case dan catatan perubahannya.
            </div>

            <div className="space-y-3">
              {testCase.versions.map((v, idx) => {
                const isCurrent = v.version === currentVersion;
                const prevVersion = testCase.versions[idx + 1];
                const isComparing = comparingVersion === v.version;

                return (
                  <div
                    key={v.id}
                    className={`p-4 rounded-lg border transition ${
                      isCurrent
                        ? "bg-surface-raised border-border-base ring-1 ring-link/30"
                        : "bg-surface-raised border-border-base"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-text-base">
                            v{v.version}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.2 rounded text-[11px] font-bold bg-ok-bg text-ok">
                              berlaku
                            </span>
                          )}
                          <span className="text-xs text-text-muted">•</span>
                          <span className="text-xs text-text-muted">
                            {new Date(v.createdAt).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                          {v.createdBy && (
                            <>
                              <span className="text-xs text-text-muted">•</span>
                              <span className="text-xs text-text-base font-medium">
                                {v.createdBy.name || v.createdBy.email}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-xs text-text-base mt-2 font-medium">
                          &ldquo;{v.changelog || "Pembaruan test case"}&rdquo;
                        </p>
                      </div>

                      {prevVersion && (
                        <button
                          type="button"
                          onClick={() =>
                            setComparingVersion(isComparing ? null : v.version)
                          }
                          className="text-xs text-link hover:underline font-semibold"
                        >
                          {isComparing ? "Tutup perbandingan" : `Bandingkan v${prevVersion.version} → v${v.version}`}
                        </button>
                      )}
                    </div>

                    {/* Diff viewer when comparing */}
                    {isComparing && prevVersion && (
                      <div className="mt-4 pt-4 border-t border-border-base text-xs space-y-3 bg-surface-sunken p-3 rounded-lg">
                        <div className="font-bold text-text-muted">Perbandingan snapshot:</div>

                        {/* Title diff */}
                        {v.snapshot?.title !== prevVersion.snapshot?.title && (
                          <div>
                            <span className="font-semibold text-text-base">Judul:</span>
                            <div className="line-through text-bad mt-0.5">
                              {prevVersion.snapshot?.title}
                            </div>
                            <div className="text-ok font-medium">{v.snapshot?.title}</div>
                          </div>
                        )}

                        {/* Priority diff */}
                        {v.snapshot?.priority !== prevVersion.snapshot?.priority && (
                          <div>
                            <span className="font-semibold text-text-base">Prioritas:</span>
                            <div className="line-through text-bad mt-0.5">
                              {prevVersion.snapshot?.priority}
                            </div>
                            <div className="text-ok font-medium">{v.snapshot?.priority}</div>
                          </div>
                        )}

                        {/* Steps diff */}
                        {v.snapshot?.steps !== prevVersion.snapshot?.steps && (
                          <div>
                            <span className="font-semibold text-text-base">Langkah-langkah:</span>
                            <div className="mt-1 space-y-1">
                              <div className="p-2 bg-bad-bg border border-bad-border rounded text-bad whitespace-pre-line">
                                {prevVersion.snapshot?.steps}
                              </div>
                              <div className="p-2 bg-ok-bg border border-ok-border rounded text-ok whitespace-pre-line">
                                {v.snapshot?.steps}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Expected result diff */}
                        {v.snapshot?.expectedResult !== prevVersion.snapshot?.expectedResult && (
                          <div>
                            <span className="font-semibold text-text-base">
                              Hasil yang diharapkan:
                            </span>
                            <div className="mt-1 space-y-1">
                              <div className="p-2 bg-bad-bg border border-bad-border rounded text-bad">
                                {prevVersion.snapshot?.expectedResult}
                              </div>
                              <div className="p-2 bg-ok-bg border border-ok-border rounded text-ok">
                                {v.snapshot?.expectedResult}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "bugs" && (
          <div className="space-y-4">
            <div className="text-xs text-text-muted">
              Bug yang tertaut atau dilaporkan dari hasil eksekusi test case ini.
            </div>

            {linkedBugs.length === 0 ? (
              <div className="p-8 text-center bg-surface-raised border border-border-base rounded-lg text-xs text-text-muted">
                Belum ada bug yang tertaut ke test case ini.
              </div>
            ) : (
              <div className="space-y-2">
                {linkedBugs.map((bug) => (
                  <Link
                    key={bug.id}
                    href={`/projects/${projectKey}/bugs/${bug.number}`}
                    className="flex items-center justify-between p-3.5 bg-surface-raised border border-border-base hover:bg-surface-sunken rounded-lg transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs text-link">{bug.key}</span>
                      <span className="text-sm font-semibold text-text-base">{bug.title}</span>
                    </div>
                    <span className="text-xs font-mono font-medium text-text-muted px-2 py-0.5 rounded bg-surface-sunken">
                      {bug.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
