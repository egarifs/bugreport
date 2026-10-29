import test from "node:test";
import assert from "node:assert/strict";
import { parseBugKeys, parseLinks, parseUrl, readScreenshots, sniffImage, SCREENSHOT_MAX_BYTES } from "./bug-input";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("bug-input validation", async () => {
  assert.equal(parseUrl("", "x"), null);
  assert.equal(parseUrl(" https://jam.dev/c/abc ", "x"), "https://jam.dev/c/abc");
  assert.throws(() => parseUrl("javascript:alert(1)", "Link"), /http/);
  assert.throws(() => parseUrl("jam.dev/c/abc", "Link"), /bukan URL valid/);
  assert.deepEqual(parseLinks("https://a.io\n\nhttps://a.io\nhttp://b.io"), ["https://a.io/", "http://b.io/"]);
  assert.throws(() => parseLinks(Array(11).fill("https://a.io").join("\n")), /Maksimal 10/);
  assert.deepEqual(parseBugKeys("crm-1, CRM-4 crm-1"), ["CRM-1", "CRM-4"]);
  assert.throws(() => parseBugKeys("CRM-1, foo"), /"FOO" bukan ID bug/);

  assert.equal(sniffImage(PNG)?.mime, "image/png");
  assert.equal(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  const ok = await readScreenshots([new File([PNG], "a b<>.png", { type: "image/png" }), "", new File([], "empty.png")]);
  assert.equal(ok.length, 1);
  assert.equal(ok[0].name, "a b__.png");
  // MIME header is ignored; bytes decide.
  await assert.rejects(readScreenshots([new File(["<svg/>"], "x.png", { type: "image/png" })]), /bukan gambar/);
  await assert.rejects(readScreenshots([new File([PNG, new Uint8Array(SCREENSHOT_MAX_BYTES)], "big.png")]), /5 MB/);
  await assert.rejects(readScreenshots(Array(6).fill(new File([PNG], "a.png"))), /Maksimal 5/);
});
