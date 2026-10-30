import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkdownTestCases, parseMarkdownBugs } from "./markdown-importer";
import { TestCasePriority, BugSeverity } from "@prisma/client";

test("parseMarkdownTestCases parses markdown table", () => {
  const md = `
# QA Test Plan

| Code | Judul | Modul | Prioritas | Tipe | Langkah | Ekspektasi |
| --- | --- | --- | --- | --- | --- | --- |
| TC-AUTH-01 | Login valid | Autentikasi | Critical | Smoke | Input user & pass | Masuk dashboard |
| TC-AUTH-02 | Login invalid | Autentikasi | High | Functional | Input pass salah | Tampil error 401 |
`;

  const parsed = parseMarkdownTestCases(md);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].code, "TC-AUTH-01");
  assert.equal(parsed[0].title, "Login valid");
  assert.equal(parsed[0].priority, TestCasePriority.CRITICAL);
  assert.equal(parsed[1].code, "TC-AUTH-02");
  assert.equal(parsed[1].priority, TestCasePriority.HIGH);
});

test("parseMarkdownTestCases parses markdown headers & bullet lists", () => {
  const md = `
## TC: Registrasi User Baru
- **Modul**: Onboarding
- **Prioritas**: High
- **Tipe**: E2E
- **Langkah**: 1. Buka /register. 2. Isi form lengkap. 3. Submit
- **Ekspektasi**: Email verifikasi terkirim

## TC: Reset Password
- **Modul**: Autentikasi
- **Prioritas**: Medium
- **Langkah**: Request reset link
- **Ekspektasi**: Link aktif 15 menit
`;

  const parsed = parseMarkdownTestCases(md);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, "Registrasi User Baru");
  assert.equal(parsed[0].moduleArea, "Onboarding");
  assert.equal(parsed[0].testType, "E2E");
  assert.equal(parsed[1].title, "Reset Password");
  assert.equal(parsed[1].steps, "Request reset link");
});

test("parseMarkdownBugs parses markdown bugs table and headings", () => {
  const mdTable = `
| Judul | Modul | Severity | Langkah | Aktual | Ekspektasi |
| --- | --- | --- | --- | --- | --- |
| Tombol checkout crash | Checkout | Critical | Klik bayar | White screen error 500 | Redirect ke payment gateway |
| Label typo di profile | Profile | Low | Buka profile | Label 'Nam' | Label 'Nama Lengkap' |
`;

  const bugs = parseMarkdownBugs(mdTable);
  assert.equal(bugs.length, 2);
  assert.equal(bugs[0].title, "Tombol checkout crash");
  assert.equal(bugs[0].severity, BugSeverity.BLOCKER);
  assert.equal(bugs[1].title, "Label typo di profile");
  assert.equal(bugs[1].severity, BugSeverity.LOW);

  const mdHeadings = `
## Bug: Gagal upload avatar ukuran 5MB
- **Modul**: Settings
- **Severity**: High
- **Langkah**: Pilih file png 5MB lalu upload
- **Aktual**: Tidak ada respon sama sekali
- **Ekspektasi**: Muncul toast ukuran file maksimal 2MB
`;

  const bugsFromHeadings = parseMarkdownBugs(mdHeadings);
  assert.equal(bugsFromHeadings.length, 1);
  assert.equal(bugsFromHeadings[0].title, "Gagal upload avatar ukuran 5MB");
  assert.equal(bugsFromHeadings[0].severity, BugSeverity.HIGH);
  assert.equal(bugsFromHeadings[0].moduleArea, "Settings");
});
