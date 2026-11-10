"use client";

import { useState } from "react";
import { NotificationDeliveryMode } from "@prisma/client";

interface PreferenceItem {
  type: string;
  label: string;
  mode: NotificationDeliveryMode;
}

interface PreferencesFormProps {
  userName: string;
  initialScope: "ALL_IN_PROJECT" | "INVOLVED_ONLY";
  initialFocusUntil: string | null;
  initialIsFocusActive: boolean;
  initialPreferences: PreferenceItem[];
}

export function PreferencesForm({
  userName,
  initialScope,
  initialFocusUntil,
  initialIsFocusActive,
  initialPreferences,
}: PreferencesFormProps) {
  const [scope, setScope] = useState<"ALL_IN_PROJECT" | "INVOLVED_ONLY">(initialScope);
  const [preferences, setPreferences] = useState<PreferenceItem[]>(initialPreferences);
  const [isFocusActive, setIsFocusActive] = useState(initialIsFocusActive);
  const [focusUntil, setFocusUntil] = useState<string | null>(initialFocusUntil);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleModeChange = (type: string, mode: NotificationDeliveryMode) => {
    setPreferences((prev) =>
      prev.map((item) => (item.type === type ? { ...item, mode } : item))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToastMessage(null);

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          preferences: preferences.map((p) => ({ type: p.type, mode: p.mode })),
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal menyimpan preferensi");
      }

      setToastMessage("Preferensi notifikasi berhasil disimpan.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage("Terjadi kesalahan saat menyimpan preferensi.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFocus = async (hours: number | null) => {
    try {
      const res = await fetch("/api/notifications/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsFocusActive(Boolean(data.isFocusActive));
        setFocusUntil(data.focusUntil ?? null);
        setToastMessage(
          hours
            ? `Mode Fokus diaktifkan untuk ${hours} jam.`
            : "Mode Fokus telah dinonaktifkan."
        );
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch {
      setToastMessage("Gagal mengubah Mode Fokus.");
    }
  };

  return (
    <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
      <header className="px-6 py-4 border-b border-slate-200 bg-surface">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Profil · {userName}
        </div>
        <h1 className="text-xl font-bold text-slate-900 mt-1">Notifikasi</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Notifikasi di aplikasi saja. Atur per jenis supaya tidak banjir saat ada agent atau impor.
        </p>
      </header>

      {toastMessage && (
        <div className="px-6 py-2.5 bg-action-soft border-b border-action/30 text-link text-sm font-medium flex items-center justify-between">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-link hover:text-link text-xs font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto">
        {/* Main Preferences Area */}
        <div className="flex-1 p-6 max-w-4xl">
          {/* Cakupan Radio Selection */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-800 mb-2">
              Cakupan
            </label>
            <div className="flex flex-wrap gap-3">
              <label
                className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                  scope === "ALL_IN_PROJECT"
                    ? "border-indigo-600 bg-action-soft/50 text-link font-semibold"
                    : "border-slate-300 bg-surface text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="ALL_IN_PROJECT"
                  checked={scope === "ALL_IN_PROJECT"}
                  onChange={() => setScope("ALL_IN_PROJECT")}
                  className="w-4 h-4 text-link focus:ring-indigo-500"
                />
                <span>Semua di project saya</span>
              </label>

              <label
                className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                  scope === "INVOLVED_ONLY"
                    ? "border-indigo-600 bg-action-soft/50 text-link font-semibold"
                    : "border-slate-300 bg-surface text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="INVOLVED_ONLY"
                  checked={scope === "INVOLVED_ONLY"}
                  onChange={() => setScope("INVOLVED_ONLY")}
                  className="w-4 h-4 text-link focus:ring-indigo-500"
                />
                <span>Hanya yang melibatkan saya</span>
              </label>
            </div>
          </div>

          {/* Preferences Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-surface shadow-2xs mb-4">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3 w-64">Kirim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preferences.map((item) => (
                  <tr key={item.type} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.label}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Mode pengiriman untuk ${item.label}`}
                        value={item.mode}
                        onChange={(e) =>
                          handleModeChange(item.type, e.target.value as NotificationDeliveryMode)
                        }
                        className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 bg-surface text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                      >
                        <option value="IMMEDIATE">Segera</option>
                        <option value="DAILY">Ringkasan harian</option>
                        <option value="PER_SESSION">Ringkasan per sesi</option>
                        <option value="OFF">Mati</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500">
            Pilihan: Segera · Ringkasan harian (pukul 08.30 WIB) · Ringkasan per sesi (satu notifikasi setelah agent/impor selesai) · Mati.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>

        {/* Sidebar Panel (Aside) */}
        <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50/70 p-6 flex flex-col gap-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Contoh ringkasan per sesi
            </h3>
            <div className="p-3.5 bg-surface border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-700 shadow-2xs">
              <strong className="block text-slate-900 font-semibold mb-1">
                Agent pi (Ega) selesai
              </strong>
              Regresi hak akses · 8 hasil: 5 lolos, 2 gagal, 1 terblokir · 1 bug baru
            </div>
          </div>

          <div className="p-3.5 bg-surface border border-slate-200 rounded-lg text-xs shadow-2xs">
            <h3 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <span>🌙</span> Mode Fokus
            </h3>
            <p className="text-slate-600 mb-3">
              Jeda semua notifikasi 1–4 jam dari lonceng. Sebutan @nama tetap masuk.
            </p>

            {isFocusActive ? (
              <div className="p-2.5 rounded bg-warn-bg border border-warn-border text-warn">
                <p className="font-semibold text-xs mb-1">Mode fokus sedang aktif</p>
                <p className="text-[11px] text-warn mb-2">
                  Berakhir:{" "}
                  {focusUntil
                    ? new Date(focusUntil).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </p>
                <button
                  type="button"
                  onClick={() => handleToggleFocus(null)}
                  className="w-full py-1 text-xs font-semibold bg-surface border border-warn-border rounded text-warn hover:bg-warn-bg/50"
                >
                  Matikan Mode Fokus
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleFocus(1)}
                  className="flex-1 py-1 text-xs font-semibold border border-slate-300 rounded bg-surface hover:bg-slate-50 text-slate-700"
                >
                  1 Jam
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleFocus(2)}
                  className="flex-1 py-1 text-xs font-semibold border border-slate-300 rounded bg-surface hover:bg-slate-50 text-slate-700"
                >
                  2 Jam
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleFocus(4)}
                  className="flex-1 py-1 text-xs font-semibold border border-slate-300 rounded bg-surface hover:bg-slate-50 text-slate-700"
                >
                  4 Jam
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
