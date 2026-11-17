import test from "node:test";
import assert from "node:assert/strict";
import { diffDocs } from "./doc-diff";

test("diffDocs: tambah, ubah, hapus, sama", () => {
  const a = "# Doc\n\n## 1 Awal\nsatu\ndua\n\n## 2 Ekspor\nCSV semua\n\n## 3 Lama\nbuang\n";
  const b = "# Doc\n\n## 1 Awal\nsatu\ndua\n\n## 2 Ekspor\nCSV Admin saja\n\n## 4 Baru\nbaru\n";
  const d = Object.fromEntries(diffDocs(a, b).map((s) => [s.heading, s]));
  assert.equal(d["1 Awal"].kind, "same");
  assert.equal(d["2 Ekspor"].kind, "changed");
  assert.deepEqual(d["2 Ekspor"].lines, [{ op: "-", text: "CSV semua" }, { op: "+", text: "CSV Admin saja" }]);
  assert.equal(d["3 Lama"].kind, "removed");
  assert.equal(d["4 Baru"].kind, "added");
});
