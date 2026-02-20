import { test, expect, loginViaStorage } from "./fixtures";

test.describe("Course List", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page);
  });

  test("shows managed courses", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Golf de Fontainebleau")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Golf de Chantilly")).toBeVisible();
  });

  test("shows course details (holes, par, role)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("18 trous")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Par 72")).toBeVisible();
    await expect(page.getByText("owner")).toBeVisible();
  });

  test("navigates to dashboard on click", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Golf de Fontainebleau").click();
    await expect(page).toHaveURL(/\/course\/course-1/);
  });
});
