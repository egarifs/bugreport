import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.waitForLoadState("networkidle");
}

test.describe("AC-AG-03: sumber akun uji (Pengaturan, mockup 95)", () => {
  test("AC-AG-03 admin menyimpan link, URL tidak valid ditolak, link tampil", async ({ page }) => {
    await login(page, "step1-qa@example.test");
    await page.goto("/projects/CRM/settings");
    const sec = page.locator('section[aria-labelledby="resource-heading"]');
    await expect(page.locator("#resource-heading")).toHaveText("Sumber akun uji");
    await expect(sec.getByText("BugBoard hanya menyimpan link")).toBeVisible();

    await sec.getByLabel("Label").first().fill("Akun uji Staging");
    await sec.getByLabel("URL").first().evaluate((el: HTMLInputElement) => { el.type = "text"; el.value = "javascript:alert(1)"; });
    await sec.getByRole("button", { name: "Simpan" }).first().click();
    await expect(sec.getByText("harus diawali http")).toBeVisible();

    await page.goto("/projects/CRM/settings"); // fresh form: server action state is per submit
    const sec2 = page.locator('section[aria-labelledby="resource-heading"]');
    await sec2.getByLabel("Label").first().fill("Akun uji Staging");
    await sec2.getByLabel("URL").first().fill("https://notion.so/akun-uji");
    await sec2.getByText("Internal + Vendor").click();
    await sec2.getByRole("button", { name: "Simpan" }).first().click();
    await expect(sec2.getByText("Link disimpan.")).toBeVisible();
    await page.reload();
    await expect(page.locator('section[aria-labelledby="resource-heading"]').getByLabel("Label").first()).toHaveValue("Akun uji Staging");
    await expect(page.getByText("Belum pernah dibuka agent.")).toBeVisible();
    await expect(page.getByText("Perubahan link dicatat di audit log.")).toBeVisible();
  });
});
