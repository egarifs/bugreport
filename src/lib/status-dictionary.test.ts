import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BugStatus, ProjectRole } from "@prisma/client";
import { STATUS_DICTIONARY, statusLabel } from "./status-dictionary";
import { BUG_TRANSITIONS, ROLE_PERMISSIONS, canTransitionBug } from "./permissions";

describe("status dictionary", () => {
  it("covers every BugStatus with label, portal label, glyph", () => {
    for (const s of Object.values(BugStatus)) {
      const d = STATUS_DICTIONARY[s];
      assert.ok(d.internal && d.portal && d.glyph, s);
    }
  });
  it("AC-DICT-01 READY_FOR_VERIFICATION labels", () => {
    assert.equal(statusLabel("READY_FOR_VERIFICATION"), "Perlu verifikasi");
    assert.equal(statusLabel("READY_FOR_VERIFICATION", "portal"), "Siap dicek");
  });
});

describe("AC-PERM-02 transition matrix (role x from x to)", () => {
  for (const role of Object.values(ProjectRole))
    for (const from of Object.values(BugStatus))
      for (const to of Object.values(BugStatus)) {
        it(`${role} ${from} -> ${to}`, () => {
          const rule = BUG_TRANSITIONS[from].find((r) => r.to === to);
          const expected = from === to || (!!rule && ROLE_PERMISSIONS[role].includes(rule.permission));
          assert.equal(canTransitionBug(from, to, role).allowed, expected);
        });
      }
  it("AC-PERM-01 VENDOR cannot close", () => {
    assert.equal(canTransitionBug("READY_FOR_VERIFICATION", "CLOSED", "VENDOR").allowed, false);
  });
});
