import test from "node:test";
import assert from "node:assert/strict";
import {
  buildShareMessage,
  formatWib,
  parseAudience,
  releasePdfFilename,
  statusLabelFor,
  summarizeRelease,
} from "./report-share";

test("report sharing (PDF + WhatsApp)", async (t) => {
  await t.test("audience falls back to external unless the user may see internal notes", () => {
    assert.equal(parseAudience("internal", true), "internal");
    assert.equal(parseAudience("internal", false), "external");
    assert.equal(parseAudience(undefined, true), "external");
    assert.equal(parseAudience("anything", true), "external");
  });

  await t.test("external readers see 'Menunggu review' instead of Draft", () => {
    assert.equal(statusLabelFor("DRAFT", "external"), "Menunggu review");
    assert.equal(statusLabelFor("DRAFT", "internal"), "Draft");
    assert.equal(statusLabelFor("IN_PROGRESS", "external"), "In progress");
  });

  await t.test("dates are always Jakarta time", () => {
    assert.equal(formatWib(new Date("2026-11-02T07:05:00Z")), "2 Nov 2026, 14.05 WIB");
    // 17:30 UTC is already the next day in Jakarta.
    assert.equal(formatWib(new Date("2026-10-31T17:30:00Z")), "1 Nov 2026, 00.30 WIB");
    assert.equal(
      releasePdfFilename("CRM", "external", new Date("2026-10-31T17:30:00Z")),
      "CRM-kesiapan-rilis-2026-11-01-eksternal.pdf"
    );
  });

  await t.test("summary counts blockers and highs from the blocker list", () => {
    const s = summarizeRelease("CRM Sismedika", {
      releaseReady: false,
      releaseBlockers: [{ severity: "HIGH" }, { severity: "HIGH" }, { severity: "BLOCKER" }],
      openBySeverity: { BLOCKER: 1, HIGH: 2, MEDIUM: 1, LOW: 1 },
    });
    assert.deepEqual(
      { b: s.blockerCount, h: s.highCount, total: s.activeTotal },
      { b: 1, h: 2, total: 5 }
    );
  });

  await t.test("WhatsApp message: bold title, verdict, optional live link", () => {
    const at = new Date("2026-11-02T07:05:00Z");
    const blocked = summarizeRelease("CRM Sismedika", {
      releaseReady: false,
      releaseBlockers: [{ severity: "HIGH" }, { severity: "HIGH" }, { severity: "HIGH" }, { severity: "HIGH" }],
      openBySeverity: { HIGH: 4, MEDIUM: 1, LOW: 1 },
    });
    assert.equal(
      buildShareMessage(blocked, { generatedAt: at, liveUrl: "https://bug.example/projects/CRM/reports" }),
      [
        "*Kesiapan rilis CRM Sismedika*",
        "Status: BELUM SIAP (4 bug High, 0 Blocker)",
        "Target: semua versi",
        "Per 2 Nov 2026, 14.05 WIB",
        "",
        "PDF terlampir.",
        "Versi live: https://bug.example/projects/CRM/reports",
      ].join("\n")
    );
    const ready = summarizeRelease("CRM", { releaseReady: true, releaseBlockers: [], openBySeverity: {} }, "1.4.0");
    const msg = buildShareMessage(ready, { generatedAt: at });
    assert.ok(msg.includes("SIAP RILIS"));
    assert.ok(msg.includes("Target: 1.4.0"));
    assert.ok(!msg.includes("Versi live"));
  });
});
