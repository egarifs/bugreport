import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
}

test("AC-BUG-04..07 banner verifikasi, lolos, masih gagal, tenggat lewat", async ({ page }) => {
  const prisma = new PrismaClient();
  const [project, qa] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { key: "CRM" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "step1-qa@example.test" } }),
  ]);
  let n = ((await prisma.bug.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } }))?.number ?? 0) + 1;
  const mk = (extra = {}) =>
    prisma.bug.create({
      data: { projectId: project.id, number: n, key: `CRM-${n++}`, title: `E2E verifikasi ${n}`, severity: "HIGH", status: "READY_FOR_VERIFICATION", reporterId: qa.id, fixedInVersion: "1.8.0", fixedInBuild: "b214", ...extra },
    });
  const pass = await mk({ dueAt: new Date(Date.now() - 2 * 86400_000) });
  const fail = await mk();

  await login(page, "step1-qa@example.test");

  await page.goto(`/projects/CRM/bugs/${pass.number}`);
  await expect(page.getByText("Siap diverifikasi di build 1.8.0 · b214")).toBeVisible();
  await expect(page.getByText(/· lewat/)).toBeVisible(); // AC-BUG-07: teks, bukan hanya warna
  await page.getByRole("button", { name: "Lolos verifikasi" }).click();
  await expect(page.getByText("Diverifikasi di", { exact: true })).toBeVisible(); // banner hilang, baris diverifikasi muncul
  const closed = await prisma.bug.findUniqueOrThrow({ where: { id: pass.id } });
  expect([closed.status, closed.verifiedInBuild]).toEqual(["CLOSED", "1.8.0 · b214"]);

  await page.goto(`/projects/CRM/bugs/${fail.number}`);
  await page.getByText("Masih gagal…").click();
  await page.getByRole("button", { name: "Buka kembali" }).click(); // alasan kosong: HTML required menahan submit
  expect((await prisma.bug.findUniqueOrThrow({ where: { id: fail.id } })).status).toBe("READY_FOR_VERIFICATION");
  await page.getByLabel("Alasan (wajib)").fill("Masih error di Safari");
  await page.getByRole("button", { name: "Buka kembali" }).click();
  await expect(page.getByRole("region", { name: "Verifikasi" })).toHaveCount(0);
  const re = await prisma.bug.findUniqueOrThrow({ where: { id: fail.id } });
  expect([re.status, re.reopenCount]).toEqual(["REOPENED", 1]);
  await prisma.$disconnect();
});

test("detail bug: QA mengisi versi perbaikan dan tenggat", async ({ page }) => {
  const prisma = new PrismaClient();
  const [project, qa] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { key: "CRM" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "step1-qa@example.test" } }),
  ]);
  const n = ((await prisma.bug.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } }))?.number ?? 0) + 1;
  const bug = await prisma.bug.create({ data: { projectId: project.id, number: n, key: `CRM-${n}`, title: "E2E field", severity: "LOW", status: "OPEN", reporterId: qa.id } });
  await login(page, "step1-qa@example.test");
  await page.goto(`/projects/CRM/bugs/${n}`);
  await page.getByLabel("Versi perbaikan").fill("2.0.1");
  await page.getByLabel("Build", { exact: true }).fill("b9");
  await page.getByLabel("Tenggat").fill("2030-01-15");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  const after = await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } });
  expect([after.fixedInVersion, after.fixedInBuild, after.dueAt?.toISOString()]).toEqual(["2.0.1", "b9", "2030-01-15T10:00:00.000Z"]);
  await expect(page.getByText("Diperbaiki di")).toBeVisible();
  await prisma.$disconnect();
});
