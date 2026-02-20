import { test, expect, loginViaStorage } from "./fixtures";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page);
  });

  test("loads course and shows dashboard panels", async ({ page }) => {
    await page.goto("/course/course-1");

    // Course name in header
    await expect(page.getByText("Golf de Fontainebleau")).toBeVisible({ timeout: 5000 });

    // Group panel
    await expect(page.getByText("Groupes en jeu")).toBeVisible();

    // Alert panel
    await expect(page.getByText("Alertes")).toBeVisible();
  });

  test("shows connection status", async ({ page }) => {
    await page.goto("/course/course-1");
    await expect(page.getByText("Golf de Fontainebleau")).toBeVisible({ timeout: 5000 });

    // Should show disconnected (no real WebSocket)
    await expect(page.getByText("Deconnecte")).toBeVisible();
  });
});
