import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await page.waitForURL(/\/projects/, { timeout: 15_000 });
}

test.describe("Step #10: Test run log percobaan", () => {
  test("AC-RUN-01 AC-RUN-04 AC-RUN-05 catat percobaan, validasi, tutup run", async ({ page }) => {
    await login(page, "step1-qa@example.test");
    await page.goto("/projects/CRM/test-runs/new");
    const name = `E2E Run ${Date.now()}`;
    await page.getByPlaceholder(/Regression Release/).fill(name);
    await page.getByPlaceholder(/Staging/).fill("Staging");
    await page.getByPlaceholder(/v1.4.0/).fill("1.7.0");
    await page.getByRole("button", { name: "Mulai test run" }).click();
    await expect(page).toHaveURL(/test-runs\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);

    // AC-RUN-04: FAIL tanpa bukti ditolak
    await page.getByLabel("Hasil", { exact: true }).selectOption("FAIL");
    await page.getByLabel(/Hasil aktual/).fill("Error 500");
    await page.getByRole("button", { name: "Simpan percobaan" }).click();
    await expect(page.getByRole("status").filter({ hasText: /bukti/i })).toBeVisible();

    // AC-RUN-01: dua percobaan, keduanya tersimpan
    await page.getByLabel(/Link bukti/).fill("https://example.com/shot.png");
    await page.getByRole("button", { name: "Simpan percobaan" }).click();
    await expect(page.getByRole("region", { name: "Log percobaan" }).getByText(/#1/)).toBeVisible();
    await page.getByLabel("Hasil", { exact: true }).selectOption("PASS");
    await page.getByRole("button", { name: "Simpan percobaan" }).click();
    await expect(page.getByRole("region", { name: "Log percobaan" }).getByText(/#2/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Log percobaan" }).getByText(/#1/)).toBeVisible();

    // AC-RUN-05: item lain Belum dijalankan harus diputuskan; keputusan wajib
    await page.getByText("Tutup test run").click();
    await page.getByLabel("Keputusan").selectOption("PASS");
    await page.getByRole("button", { name: "Tutup run" }).click();
    await expect(page.getByRole("status").filter({ hasText: /alasan/i }).first()).toBeVisible();
  });
});
