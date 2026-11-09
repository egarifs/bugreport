import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
}

test.describe("Step #8: Preferensi Notifikasi & Mode Fokus (G5)", () => {
  test("Navigasi ke preferensi notifikasi, ubah konfigurasi dan aktifkan mode fokus", async ({ page }) => {
    // 1. Dev login
    await login(page, "step1-qa@example.test");

    // 2. Buka halaman preferensi notifikasi
    await page.goto("/profile/notifications");
    await expect(page.locator("h1")).toContainText("Notifikasi");
    await expect(page.locator("text=Cakupan")).toBeVisible();

    // 3. Ubah cakupan ke "Semua di project saya"
    const radioAll = page.locator("text=Semua di project saya");
    await radioAll.click();

    // 4. Ubah preferensi draf ke "Segera"
    const draftSelect = page.locator('select[aria-label="Mode pengiriman untuk Draft baru menunggu triase"]');
    await draftSelect.selectOption("IMMEDIATE");

    // 5. Simpan perubahan
    await page.click('button:has-text("Simpan Perubahan")');
    await expect(page.locator("text=Preferensi notifikasi berhasil disimpan.")).toBeVisible();

    // 6. Test Mode Fokus toggle di aside panel
    await page.click('button:has-text("2 Jam")');
    await expect(page.locator("text=Mode fokus sedang aktif")).toBeVisible();

    // 7. Matikan mode fokus
    await page.click('button:has-text("Matikan Mode Fokus")');
    await expect(page.locator("text=Mode Fokus telah dinonaktifkan.")).toBeVisible();
    await expect(page.locator('button:has-text("2 Jam")')).toBeVisible();
  });
});
