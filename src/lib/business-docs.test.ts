import test from "node:test";
import assert from "node:assert/strict";
import { docFilePath, rankSections, splitSections } from "./business-docs";

test("business-docs: split, rank, safe path", () => {
  const md = "intro\n# Produk\nCRM untuk RS\n## Aturan diskon\nDiskon maksimal 10% untuk paket.\n## Login\nSSO Google";
  const s = splitSections(md);
  assert.deepEqual(s.map((x) => x.heading), ["(awal dokumen)", "Produk", "Aturan diskon", "Login"]);
  assert.equal(rankSections(s, "berapa diskon paket?")[0].heading, "Aturan diskon");
  assert.deepEqual(rankSections(s, "jelaskan tentang"), []);
  assert.equal(splitSections("# A\n" + "x".repeat(7000), 3000).length, 3);
  // storedPath from DB may be absolute from another host or hostile; only basename is used.
  assert.equal(docFilePath("CRM", "/etc/../../passwd"), docFilePath("CRM", "passwd"));
  assert.ok(docFilePath("CRM", "/app/uploads/CRM/docs/a.md").endsWith("/uploads/CRM/docs/a.md"));
});
