import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createBugs, syncBugSeq } from "./helpers/bugs";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
}

test("lapor bug: peringatan mirip, panduan, prioritas hanya untuk reviewer", async ({ page, browser }) => {
  const prisma = new PrismaClient();
  const project = await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } });
  const qa = await prisma.user.findUniqueOrThrow({ where: { email: "step1-qa@example.test" } });
  const title = `Pemindahan pemilik kontak ${Math.random().toString(36).slice(2, 10)} gagal`; // unique: API returns top 5 only
  const [{ number: n }] = await createBugs(prisma, project, [{ title, severity: "HIGH", status: "READY_FOR_VERIFICATION", reporterId: qa.id }]);

  await login(page, "step1-qa@example.test");
  await page.goto("/projects/CRM/bugs/new");
  await page.getByText("Tambah detail").click();
  await expect(page.getByLabel("Prioritas")).toBeVisible();
  await page.getByText("Panduan severity × prioritas").click();
  await expect(page.getByText("dampak ke pengguna")).toBeVisible();
  await page.getByLabel("Judul bug").fill(title);
  const warn = page.getByRole("status").filter({ hasText: "Mirip CRM-" });
  await expect(warn.getByText(`CRM-${n}`, { exact: true })).toBeVisible();
  await expect(warn).toBeVisible();
  await expect(warn.getByText("Ready for QA").first()).toBeVisible(); // label kamus, bukan READY_FOR_VERIFICATION
  await expect(warn.getByRole("link", { name: /Buka/ }).first()).toHaveAttribute("href", /\/bugs\/\d+$/);

  const email = "client-e2e@example.test";
  const user = await prisma.user.upsert({ where: { email }, create: { email, name: "Client E2E", status: "ACTIVE" }, update: {} });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role: "CLIENT" }, update: { role: "CLIENT" },
  });
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await login(p2, email);
  await p2.goto("/projects/CRM/bugs/new");
  await p2.getByText("Tambah detail").click();
  await expect(p2.getByLabel("Prioritas")).toHaveCount(0);
  await ctx.close();
  await prisma.$disconnect();
});

test("lapor bug: draf tersimpan otomatis, pulih setelah reload, bisa dihapus", async ({ page }) => {
  await login(page, "step1-qa@example.test");
  await page.goto("/projects/CRM/bugs/new");
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bugdraft:")).forEach((k) => localStorage.removeItem(k)));
  await page.reload();
  await page.getByLabel("Judul bug").fill("Draf otomatis e2e");
  await page.getByText("Tambah detail").click();
  await page.getByLabel("Catatan").fill("isi deskripsi");
  await expect(page.getByText("Draf tersimpan otomatis")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Judul bug")).toHaveValue("Draf otomatis e2e");
  await expect(page.getByLabel("Catatan")).toHaveValue("isi deskripsi");
  await expect(page.getByText("Draf sebelumnya dipulihkan")).toBeVisible();
  await page.getByRole("button", { name: "Hapus draf" }).click();
  await expect(page.getByLabel("Judul bug")).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("Judul bug")).toHaveValue("");
});

test("lapor bug: tag dari form tersimpan dan tampil di detail", async ({ page }) => {
  const prisma = new PrismaClient();
  const title = `E2E form tag ${Date.now()}`;
  await syncBugSeq(prisma, (await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } })).id); // other specs insert bugs directly
  await login(page, "step1-qa@example.test");
  await page.goto("/projects/CRM/bugs/new");
  await page.getByLabel("Judul bug").fill(title);
  await page.getByText("Tambah detail").click();
  await page.getByText(/^Lainnya/).click();
  await page.getByLabel("Tag", { exact: true }).fill("Login Page, UI, #ui");
  await page.getByRole("button", { name: "Simpan & buka detail" }).click();
  await expect(page).toHaveURL(/\/bugs\/\d+$/);
  await expect(page.getByText(/^#login-page/)).toBeVisible();
  await expect(page.getByText(/^#ui/)).toBeVisible();
  const bug = await prisma.bug.findFirstOrThrow({ where: { title }, include: { tags: true } });
  expect(bug.tags.map((t) => t.name).sort()).toEqual(["login-page", "ui"]);
  await prisma.$disconnect();
});

test("lapor bug cepat: judul saja, Ctrl+Enter, form kosong lagi, pilihan terakhir diingat", async ({ page }) => {
  const prisma = new PrismaClient();
  const stamp = Date.now();
  await syncBugSeq(prisma, (await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } })).id);
  await login(page, "step1-qa@example.test");
  await page.goto("/projects/CRM/bugs/new");
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bug")).forEach((k) => localStorage.removeItem(k)));
  await page.reload();
  await expect(page.getByLabel("Judul bug")).toBeFocused();

  // only the title is needed; severity falls back to Medium, no module, saved as Draft
  await page.getByLabel("Judul bug").fill(`E2E cepat A ${stamp}`);
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText(/dibuat\./)).toBeVisible();
  await expect(page.getByLabel("Judul bug")).toHaveValue("");
  await expect(page.getByLabel("Judul bug")).toBeFocused();
  const a = await prisma.bug.findFirstOrThrow({ where: { title: `E2E cepat A ${stamp}` } });
  expect([a.severity, a.status, a.moduleId]).toEqual(["MEDIUM", "DRAFT", null]);

  // choose severity and module once; the next report starts with them
  await page.getByLabel("Judul bug").fill(`E2E cepat B ${stamp}`);
  await page.getByText("Tambah detail").click();
  await page.getByLabel("Severity").selectOption("HIGH");
  const modules = await page.locator("select[name=moduleId] option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
  if (modules[0]) await page.locator("select[name=moduleId]").selectOption(modules[0]);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText(/dibuat\./)).toBeVisible();
  await expect(page.getByLabel("Severity")).toHaveValue("HIGH");
  if (modules[0]) await expect(page.locator("select[name=moduleId]")).toHaveValue(modules[0]);
  await expect(page.getByLabel("Judul bug")).toHaveValue("");
  const b = await prisma.bug.findFirstOrThrow({ where: { title: `E2E cepat B ${stamp}` } });
  expect(b.severity).toBe("HIGH");

  // the draft from the first report is spent, a reload does not bring it back
  await page.reload();
  await expect(page.getByLabel("Judul bug")).toHaveValue("");
  await prisma.$disconnect();
});

test("pintasan N di daftar bug membuka form lapor", async ({ page }) => {
  await login(page, "step1-qa@example.test");
  await page.goto("/projects/CRM?view=all");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("n");
  await expect(page).toHaveURL(/\/bugs\/new$/);
});
