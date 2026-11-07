import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

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
  const n = ((await prisma.bug.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } }))?.number ?? 0) + 1;
  await prisma.bug.create({ data: { projectId: project.id, number: n, key: `CRM-${n}`, title, severity: "HIGH", status: "READY_FOR_VERIFICATION", reporterId: qa.id } });

  await login(page, "step1-qa@example.test");
  await page.goto("/projects/CRM/bugs/new");
  await expect(page.getByLabel("Prioritas")).toBeVisible();
  await page.getByText("Panduan severity × prioritas").click();
  await expect(page.getByText("dampak ke pengguna")).toBeVisible();
  await page.getByLabel("Judul bug *").fill(title);
  const warn = page.getByRole("status").filter({ hasText: "Mirip CRM-" });
  await expect(warn.getByText(`CRM-${n}`, { exact: true })).toBeVisible();
  await expect(warn).toBeVisible();
  await expect(warn.getByText("Perlu verifikasi").first()).toBeVisible(); // label kamus, bukan READY_FOR_VERIFICATION
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
  await expect(p2.getByLabel("Prioritas")).toHaveCount(0);
  await expect(p2.getByText("Prioritas ditentukan QA saat triase.")).toBeVisible();
  await ctx.close();
  await prisma.$disconnect();
});

test("lapor bug: draf tersimpan otomatis, pulih setelah reload, bisa dihapus", async ({ page }) => {
  await login(page, "step1-qa@example.test");
  await page.goto("/projects/CRM/bugs/new");
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bugdraft:")).forEach((k) => localStorage.removeItem(k)));
  await page.reload();
  await page.getByLabel("Judul bug *").fill("Draf otomatis e2e");
  await page.getByLabel("Deskripsi").fill("isi deskripsi");
  await expect(page.getByText("Draf tersimpan otomatis")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Judul bug *")).toHaveValue("Draf otomatis e2e");
  await expect(page.getByLabel("Deskripsi")).toHaveValue("isi deskripsi");
  await expect(page.getByText("Draf sebelumnya dipulihkan")).toBeVisible();
  await page.getByRole("button", { name: "Hapus draf" }).click();
  await expect(page.getByLabel("Judul bug *")).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("Judul bug *")).toHaveValue("");
});
