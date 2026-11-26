import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createBugs, syncBugSeq } from "./helpers/bugs";

// Second half of the "bugreport" regression cases: reporting, import, test run indicator. Test names start with the case code(s).
const prisma = new PrismaClient();
test.afterAll(async () => { await prisma.$disconnect(); });

const EMAIL = "bgr-qa2@example.test";
async function login(page: Page) {
  const project = await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } });
  const user = await prisma.user.upsert({ where: { email: EMAIL }, create: { email: EMAIL, name: "BGR QA2", status: "ACTIVE" }, update: { status: "ACTIVE" } });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role: "QA" }, update: { role: "QA" },
  });
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(EMAIL);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  return { project, user };
}
const stamp = () => `E2E-BGR2 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

test("TC-RPT-001: lapor bug dengan data lengkap membuka detail dengan nomor berikutnya", async ({ page }) => {
  const { project } = await login(page);
  await syncBugSeq(prisma, project.id);
  const before = (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).bugSeq;
  const title = stamp();
  const mod = await prisma.module.findFirstOrThrow({ where: { projectId: project.id } });
  await page.goto("/projects/CRM/bugs/new");
  await page.getByLabel("Judul bug").fill(title);
  await page.getByText("Tambah detail").click();
  await page.getByLabel("Severity").selectOption("HIGH");
  await page.locator("select[name=moduleId]").selectOption(mod.id);
  await page.getByText(/^Lainnya/).click();
  await page.getByText("Pakai kolom terpisah").click();
  await page.getByLabel("Langkah reproduksi").fill("1) buka halaman");
  await page.getByLabel("Hasil aktual").fill("error 500");
  await page.getByLabel("Hasil yang diharapkan").fill("sukses");
  await page.getByRole("button", { name: "Simpan & buka detail" }).click();
  await expect(page).toHaveURL(new RegExp(`/bugs/${before + 1}$`));
  const bug = await prisma.bug.findFirstOrThrow({ where: { title } });
  expect([bug.key, bug.severity, bug.status, bug.moduleId]).toEqual([`CRM-${before + 1}`, "HIGH", "DRAFT", mod.id]);
});

test("TC-RPT-005: judul wajib dan link harus http/https", async ({ page }) => {
  const { project } = await login(page);
  await syncBugSeq(prisma, project.id);
  const count = () => prisma.bug.count({ where: { projectId: project.id } });
  const before = await count();
  await page.goto("/projects/CRM/bugs/new");
  await page.getByRole("button", { name: "Simpan", exact: true }).click(); // empty title: the browser blocks the submit
  expect(await page.getByLabel("Judul bug").evaluate((el) => (el as HTMLInputElement).validity.valueMissing)).toBe(true);
  expect(await count()).toBe(before);

  await page.getByLabel("Judul bug").fill(stamp());
  await page.getByText("Tambah detail").click();
  await page.getByText(/^Lainnya/).click();
  await page.getByLabel("Rekaman jam.dev").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.locator("[data-form-error], :invalid").first()).toBeVisible();
  expect(await count()).toBe(before);
});

test("TC-RPT-008: tempel screenshot dengan Ctrl+V lalu simpan melampirkannya", async ({ page }) => {
  const { project } = await login(page);
  await syncBugSeq(prisma, project.id);
  const title = stamp();
  await page.goto("/projects/CRM/bugs/new");
  await page.getByLabel("Judul bug").fill(title);
  await page.evaluate(() => {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([png], "shot.png", { type: "image/png" }));
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  });
  await expect(page.getByText("1 screenshot terlampir")).toBeVisible();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText(/dibuat\./)).toBeVisible();
  await expect(page.getByLabel("Judul bug")).toHaveValue("");
  await expect(page.getByText("screenshot terlampir")).toHaveCount(0);
  const bug = await prisma.bug.findFirstOrThrow({ where: { title }, include: { _count: { select: { attachments: true } } } });
  expect(bug._count.attachments).toBe(1);
});

test("TC-IMP-001 TC-IMP-002 TC-IMP-003: pratinjau menandai mirip, impor Draft berurutan, file salah ditolak", async ({ page }) => {
  const { project, user } = await login(page);
  await syncBugSeq(prisma, project.id);
  const s = stamp();
  const [dup] = await createBugs(prisma, project, [{ title: `${s} duplikat`, reporterId: user.id }]);
  const last = dup.number - 1;
  const md = `| Judul | Modul | Severity | Langkah | Aktual | Ekspektasi |\n| --- | --- | --- | --- | --- | --- |\n| ${s} duplikat | - | High | a | b | c |\n| ${s} baru | - | Low | a | b | c |\n`;
  const before = await prisma.bug.count({ where: { projectId: project.id } });

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/projects/CRM?view=all");
  await page.getByRole("button", { name: "Impor Bug (.md)" }).click();
  const dialog = page.getByRole("dialog", { name: "Impor bug dari Markdown" });
  await dialog.getByLabel("File Markdown (.md)").setInputFiles({ name: "kosong.md", mimeType: "text/markdown", buffer: Buffer.from("tidak ada tabel di sini") });
  await expect(dialog.getByText("Tidak ada bug yang terbaca")).toBeVisible();
  expect(await prisma.bug.count({ where: { projectId: project.id } })).toBe(before);

  await dialog.getByLabel("File Markdown (.md)").setInputFiles({ name: "bug.md", mimeType: "text/markdown", buffer: Buffer.from(md) });
  await expect(dialog.getByRole("row").filter({ hasText: `${s} duplikat` })).toContainText("Mirip");
  await expect(dialog.getByRole("row").filter({ hasText: `${s} duplikat` })).toContainText(`Mirip CRM-${last + 1}`);
  await expect(dialog.getByRole("row").filter({ hasText: `${s} baru` })).toContainText("Siap");
  expect(await prisma.bug.count({ where: { projectId: project.id } })).toBe(before); // preview creates nothing

  await dialog.getByRole("button", { name: "Impor 2 bug" }).click();
  await expect(dialog).toBeHidden();
  const imported = await prisma.bug.findMany({ where: { projectId: project.id, title: { startsWith: s }, status: "DRAFT" }, orderBy: { number: "asc" } });
  expect(imported.map((b) => b.title)).toEqual([`${s} duplikat`, `${s} baru`]);
  expect(imported[1].number).toBe(imported[0].number + 1);
  expect(imported[0].number).toBeGreaterThan(last + 1);
});

async function seedRun(items: ("PASS" | "FAIL" | "NOT_RUN")[]) {
  const { project, user } = { project: await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } }), user: await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } }) };
  const s = Date.now() + Math.random().toString(36).slice(2, 5);
  const cases = await Promise.all(items.map((_, i) => prisma.testCase.create({ data: { projectId: project.id, code: `TC-BGRRUN-${s}-${i}`, title: `Run case ${i}`, steps: "1) a", expectedResult: "ok" } })));
  const run = await prisma.testRun.create({
    data: { projectId: project.id, name: `E2E BGR run ${s}`, environment: "Staging", createdById: user.id, items: { create: cases.map((c, i) => ({ testCaseId: c.id, status: items[i] })) } },
  });
  return { run, cases };
}

test("TC-RUN-003: tetap berputar selama ada yang belum dijalankan, merah setelah semua dijalankan", async ({ page }) => {
  await login(page);
  const { run, cases } = await seedRun(["PASS", "NOT_RUN"]);
  await page.goto(`/projects/CRM/test-runs/${run.id}`);
  await expect(page.getByRole("status").filter({ hasText: "Menunggu dijalankan" })).toContainText("1/2");
  await prisma.testRunItem.updateMany({ where: { testRunId: run.id, status: "NOT_RUN" }, data: { status: "FAIL" } });
  await page.reload();
  const red = page.getByRole("status").filter({ hasText: "Gagal" });
  await expect(red).toContainText("2/2");
  await expect(page.locator(".run-stripes")).toHaveCount(0);
  await prisma.testRun.delete({ where: { id: run.id } });
  await prisma.testCase.deleteMany({ where: { id: { in: cases.map((c) => c.id) } } });
});

test("TC-RUN-004 TC-RUN-005: daftar run menampilkan status dan progres, reduced motion mematikan animasi", async ({ page }) => {
  await login(page);
  const { run, cases } = await seedRun(["PASS", "NOT_RUN"]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/projects/CRM/test-cases?tab=runs");
  const card = page.getByRole("link", { name: new RegExp(run.name) });
  await expect(card).toContainText("Menunggu dijalankan");
  await expect(card).toContainText("1/2");
  await expect(card.locator("[role=progressbar], .run-stripes, [class*=bg-]").first()).toBeVisible();

  await page.goto(`/projects/CRM/test-runs/${run.id}`);
  const status = page.getByRole("status").filter({ hasText: "Menunggu dijalankan" });
  await expect(status).toBeVisible(); // still readable from text
  const names = await page.evaluate(() => [...document.querySelectorAll("svg.animate-spin, .run-stripes")].map((el) => getComputedStyle(el).animationName));
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(n).toBe("none");
  await prisma.testRun.delete({ where: { id: run.id } });
  await prisma.testCase.deleteMany({ where: { id: { in: cases.map((c) => c.id) } } });
});
