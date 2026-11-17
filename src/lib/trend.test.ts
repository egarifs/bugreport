import test from "node:test";
import assert from "node:assert/strict";
import { computeTrend, type TrendBug } from "./trend";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const bug = (o: Partial<TrendBug>): TrendBug => ({ id: "x", createdAt: d("2026-10-21"), severity: "HIGH", moduleName: "Kontak", reopenCount: 0, dueAt: null, closedAt: null, ...o });

test("computeTrend: minggu, selesai, median, SLA, reopen, modul", () => {
  const from = d("2026-10-20"), to = d("2026-11-03");
  const r = computeTrend([
    bug({ closedAt: d("2026-10-23") }),                                   // HIGH ditutup 2 hari: lewat SLA 8j
    bug({ createdAt: d("2026-10-28"), severity: "LOW", moduleName: null, reopenCount: 1, closedAt: d("2026-10-30") }),
    bug({ createdAt: d("2026-10-01"), closedAt: d("2026-10-29") }),       // dibuat sebelum rentang: hanya selesai
  ], from, to);
  assert.equal(r.weeks.length, 2);
  assert.deepEqual(r.weeks.map((w) => [w.masuk, w.selesai]), [[1, 1], [1, 2]]);
  assert.equal(r.masuk, 2);
  assert.equal(r.selesai, 3);
  assert.equal(r.reopenRate, 50);
  assert.equal(r.late, 1);
  assert.equal(r.medianDays, 2);
  assert.equal(r.modules[0].name, "Kontak");
  assert.equal(computeTrend([bug({ ended: true })], from, to).late, 0); // Invalid tanpa Closed bukan terlambat
  assert.equal(computeTrend([], from, to).medianDays, null);
});
