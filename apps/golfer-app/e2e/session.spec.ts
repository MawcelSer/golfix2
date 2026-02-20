import { test, expect } from "./fixtures";

test.describe("Session flow", () => {
  /** Login → navigate to GPS screen with course slug */
  async function loginAndGoToGps(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@golfix.fr");
    await page.getByLabel("Mot de passe").fill("password123");
    await page.getByRole("button", { name: "Connexion" }).click();
    await expect(page).toHaveURL(/\/gps/);

    // Navigate to GPS with course param
    await page.goto("/gps?course=royal-golf-marrakech");

    // Wait for course data to load and session confirmation to appear
    await expect(page.getByText("Royal Golf Marrakech")).toBeVisible({ timeout: 5000 });
  }

  test("GPS screen shows session confirmation when course loaded", async ({ page }) => {
    await loginAndGoToGps(page);

    await expect(page.getByText("18 trous — Par 72")).toBeVisible();
    await expect(page.getByRole("button", { name: "Commencer la session" })).toBeVisible();
  });

  test("clicking 'Commencer la session' starts session and shows GPS distances", async ({
    page,
  }) => {
    await loginAndGoToGps(page);

    await page.getByRole("button", { name: "Commencer la session" }).click();

    // Session is now active — GPS distances should be visible
    await expect(page.getByText("Avant")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Centre")).toBeVisible();
    await expect(page.getByText("Arrière")).toBeVisible();
  });

  test("scorecard shows 'Terminer la partie' during active session", async ({ page }) => {
    await loginAndGoToGps(page);

    // Start session
    await page.getByRole("button", { name: "Commencer la session" }).click();
    await expect(page.getByText("Avant")).toBeVisible({ timeout: 5000 });

    // Navigate to scorecard tab
    await page.getByRole("link", { name: /carte/i }).click();
    await expect(page).toHaveURL(/\/scorecard/);

    await expect(page.getByRole("button", { name: "Terminer la partie" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("ending session navigates back to landing", async ({ page }) => {
    await loginAndGoToGps(page);

    // Start session
    await page.getByRole("button", { name: "Commencer la session" }).click();
    await expect(page.getByText("Avant")).toBeVisible({ timeout: 5000 });

    // Navigate to scorecard
    await page.getByRole("link", { name: /carte/i }).click();
    await expect(page.getByRole("button", { name: "Terminer la partie" })).toBeVisible({
      timeout: 5000,
    });

    // Click end session — opens custom ConfirmDialog
    await page.getByRole("button", { name: "Terminer la partie" }).click();

    // Accept the custom confirm dialog
    await page.getByRole("button", { name: "Confirmer" }).click();

    // Should navigate to landing page
    await expect(page).toHaveURL("/");
    await expect(page.getByText(/Bienvenue/)).toBeVisible({ timeout: 5000 });
  });
});
