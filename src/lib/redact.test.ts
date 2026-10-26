import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "./redact";

describe("redactSecrets", () => {
  it("redacts Authorization Bearer tokens", () => {
    const input = "Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret123456789";
    const res = redactSecrets(input);
    assert.equal(res, "Headers: Authorization: Bearer [REDACTED]");
  });

  it("redacts api_key and password pairs", () => {
    const input = 'config: api_key="secret_key_12345" and password=supersecretpass';
    const res = redactSecrets(input);
    assert.match(res, /\[REDACTED\]/);
    assert.equal(res.includes("secret_key_12345"), false);
    assert.equal(res.includes("supersecretpass"), false);
  });

  it("redacts Anthropic Claude tokens", () => {
    const input = "Use key sk-ant-api03-abcdefghijklmnopqrstuvwxyz12345 to call";
    const res = redactSecrets(input);
    assert.equal(res, "Use key [REDACTED_SECRET] to call");
  });

  it("leaves clean strings untouched", () => {
    const clean = "User cannot click checkout button on Safari";
    assert.equal(redactSecrets(clean), clean);
  });
});
