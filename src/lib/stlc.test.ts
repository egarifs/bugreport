import test from "node:test";
import assert from "node:assert/strict";
import { buildReleaseNotes, closeVerdict, dodChecklist, exitStatus, type NoteBug } from "./stlc";

const facts = { blockerOpen: [], highOpen: ["CRM-6"], runsOpen: [], reqNotVerified: [], hasSummary: false };

test("dodChecklist menghormati butir aktif; closeVerdict butuh alasan bila merah", () => {
  const all = dodChecklist(["BLOCKER", "HIGH", "SUMMARY"], facts);
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((i) => i.ok), [true, false, false]);
  assert.equal(closeVerdict(all, "  ").ok, false);
  assert.deepEqual(closeVerdict(all, "menunggu vendor"), { ok: true, exception: true });
  assert.deepEqual(closeVerdict(dodChecklist(["BLOCKER"], facts), ""), { ok: true, exception: false });
});

test("exitStatus informatif", () => {
  const r = exitStatus({ blockersOpen: [], highOpen: ["CRM-6", "CRM-9"], coveragePct: 88, target: 90 });
  assert.deepEqual(r.map((x) => x.ok), [true, false, false]);
});

test("buildReleaseNotes: eksternal menyembunyikan Invalid & nama, memakai judul tulis ulang", () => {
  const b = (o: Partial<NoteBug>): NoteBug => ({ key: "CRM-1", title: "Internal judul", status: "CLOSED", severity: "HIGH", assignee: "Dimas", fixedInVersion: "1.8.0", appVersion: null, ...o });
  const bugs = [b({}), b({ key: "CRM-2", status: "INVALID" }), b({ key: "CRM-3", status: "OPEN", fixedInVersion: null, appVersion: "1.8.0" })];
  const ext = buildReleaseNotes(bugs, "1.8.0", { "CRM-1": "Impor file besar kini berhasil" }, true);
  assert.deepEqual(ext.fixes.map((x) => x.text), ["Impor file besar kini berhasil"]);
  assert.equal(ext.fixes[0].meta, "");
  assert.equal(ext.known.length, 1);
  const int = buildReleaseNotes(bugs, "1.8.0", {}, false);
  assert.equal(int.fixes.length, 1);
  assert.match(int.fixes[0].meta, /Dimas/);
});
