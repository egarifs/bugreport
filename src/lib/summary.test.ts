import test from "node:test";
import assert from "node:assert/strict";
import { burndown, foundPerWeek, workload, computeSummary, type SummaryBug } from "./summary";

const now = new Date("2026-11-24T00:00:00Z");
const bug = (o: Partial<SummaryBug>): SummaryBug => ({ status: "OPEN", severity: "HIGH", moduleName: "Kontak", createdAt: new Date("2026-11-23T00:00:00Z"), ...o });

test("computeSummary: status, modul, umur; Draft diabaikan, penolakan digabung", () => {
  const r = computeSummary([
    bug({}),
    bug({ status: "CLOSED" }),
    bug({ status: "DRAFT" }),
    bug({ status: "WONT_FIX" }),
    bug({ status: "INVALID" }),
    bug({ status: "REOPENED", severity: "LOW", moduleName: null, createdAt: new Date("2026-11-01T00:00:00Z") }),
  ], now);
  assert.equal(r.total, 5);
  assert.equal(r.status.find((s) => s.key === "REJECTED")?.count, 2);
  assert.deepEqual(r.modules.find((m) => m.name === "Kontak"), { name: "Kontak", open: 1, passed: 1 });
  assert.equal(r.modules.find((m) => m.name === "Tanpa modul")?.open, 1);
  assert.equal(r.age[0].bySeverity.HIGH, 1);
  assert.equal(r.age[3].bySeverity.LOW, 1);
});

test("foundPerWeek, burndown, workload", () => {
  const from = new Date("2026-11-01T00:00:00Z"), to = new Date("2026-11-15T00:00:00Z");
  const w = foundPerWeek([new Date("2026-11-02T00:00:00Z"), new Date("2026-11-09T00:00:00Z"), new Date("2026-12-01T00:00:00Z")], from, to);
  assert.deepEqual(w.map((x) => x.count), [1, 1]);
  const b = burndown([{ createdAt: from, closedAt: new Date("2026-11-05T00:00:00Z") }, { createdAt: from, closedAt: null }], from, to);
  assert.equal(b.length, 14);
  assert.equal(b[0].remaining, 2);
  assert.equal(b[13].remaining, 1);
  assert.equal(b[13].ideal, 0);
  const l = workload([{ severity: "HIGH", assignees: ["Budi"] }, { severity: "LOW", assignees: [] }]);
  assert.deepEqual(l.map((x) => x.name), ["Belum ditugaskan", "Budi"]);
});
