import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await page.waitForURL(/\/projects/, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("Step #9: Test Case Form, Versi & Riwayat (F8)", () => {
  test("Alur lengkap tambah test case v1, ubah menjadi v2 dengan changelog, dan toggle status usang", async ({
    page,
  }) => {
    page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
    page.on("console", (message) => { if (message.type() === "error") console.log("CONSOLE ERROR:", message.text()); });
    page.on("requestfailed", (request) => console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText));

    // 1. Dev login admin/qa
    await login(page, "step1-qa@example.test");

    // 2. Buka repository test cases di project CRM
    await page.goto("/projects/CRM/test-cases");
    await expect(page.locator("h2")).toContainText("Repository Test Case");

    // 3. Klik tombol "+ Test case baru"
    await page.click('text="+ Test case baru"');
    await expect(page).toHaveURL(/\/projects\/CRM\/test-cases\/new/);
    await expect(page.locator("h1")).toContainText(/Tambah test case/i);

    // 4. Isi form tambah test case
    const uniqueTitle = `E2E Test Checkout Flow ${Date.now()}`;
    await page.fill('input[id="title"]', uniqueTitle);
    await page.fill('input[id="precondition"]', "User telah login dan keranjang terisi 1 barang");

    // Langkah 1
    const firstStepInput = page.locator('input[placeholder^="Langkah 1"]');
    await firstStepInput.fill("Buka halaman /checkout");

    // Tambah langkah 2
    await page.click('button:has-text("+ Tambah langkah")');
    const secondStepInput = page.locator('input[placeholder^="Langkah 2"]');
    await secondStepInput.fill("Pilih metode pembayaran Transfer Bank");

    await page.fill('textarea[id="expectedResult"]', "Instruksi transfer dan nomor virtual account muncul.");

    // Submit form simpan
    await page.click('footer button:has-text("Simpan")');

    // 5. Verifikasi diarahkan ke halaman detail test case (UUID)
    await expect(page).toHaveURL(/\/projects\/CRM\/test-cases\/[0-9a-fA-F-]{36}$/);
    await expect(page.locator("h1")).toContainText(uniqueTitle);
    await expect(page.locator("header")).toContainText("Versi 1");
    await expect(page.locator("header")).toContainText("Siap");

    // 6. Klik tombol Ubah
    await page.click('header a:has-text("Ubah")');
    await expect(page).toHaveURL(/\/projects\/CRM\/test-cases\/[0-9a-fA-F-]{36}\/edit/);
    await expect(page.locator("h1")).toContainText(/Ubah test case/i);

    // 7. Tambahkan langkah baru dan isi changelog
    await page.click('button:has-text("+ Tambah langkah")');
    const thirdStepInput = page.locator('input[placeholder^="Langkah 3"]');
    await thirdStepInput.fill("Klik tombol Bayar Sekarang");

    await page.fill('input[id="changelog"]', "Menambahkan langkah final konfirmasi bayar");

    // Simpan perubahan
    await page.click('footer button:has-text("Simpan Perubahan")');

    // 8. Verifikasi diarahkan kembali ke detail dengan Versi 2
    await expect(page).toHaveURL(/\/projects\/CRM\/test-cases\/[0-9a-fA-F-]{36}$/);
    await expect(page.locator("header")).toContainText("Versi 2");

    // 9. Buka tab Versi
    await page.click('nav button:has-text("Versi")');
    await expect(page.getByText("v2", { exact: true })).toBeVisible();
    await expect(page.getByText("v1", { exact: true })).toBeVisible();
    await expect(page.locator("text=Menambahkan langkah final konfirmasi bayar")).toBeVisible();

    // 10. Toggle status "Tandai usang" -> "Aktifkan kembali"
    await page.click('header button:has-text("Tandai usang")');
    await expect(page.locator("header")).toContainText("Usang");
    await expect(page.locator('header button:has-text("Aktifkan kembali")')).toBeVisible();

    await page.click('header button:has-text("Aktifkan kembali")');
    await expect(page.locator("header")).toContainText("Siap");
  });
});
