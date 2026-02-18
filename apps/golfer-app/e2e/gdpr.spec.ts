import { test, expect } from "./fixtures";

test.describe("GDPR consent flow", () => {
  /** Helper: login and navigate to landing page */
  async function loginAndGoHome(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@golfix.fr");
    await page.getByLabel("Mot de passe").fill("password123");
    await page.getByRole("button", { name: "Connexion" }).click();
    await expect(page).toHaveURL(/\/gps/);

    // Navigate to home (landing) via URL manipulation within SPA
    await page.evaluate(() => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    // Wait for landing page content
    await expect(page.getByText("Démarrer un parcours")).toBeVisible({ timeout: 5000 });
  }

  test("shows GDPR modal when starting without consent", async ({ page }) => {
    await loginAndGoHome(page);

    // Click start — should show GDPR modal first
    await page.getByRole("button", { name: "Démarrer un parcours" }).click();
    await expect(page.getByText("Suivi GPS")).toBeVisible();
    await expect(page.getByText(/position GPS/i)).toBeVisible();
  });

  test("accept GDPR closes modal", async ({ page }) => {
    await loginAndGoHome(page);

    await page.getByRole("button", { name: "Démarrer un parcours" }).click();
    await expect(page.getByText("Suivi GPS")).toBeVisible();

    await page.getByRole("button", { name: "Accepter" }).click();
    await expect(page.getByText("Suivi GPS")).not.toBeVisible();
  });

  test("refuse GDPR closes modal without navigating", async ({ page }) => {
    await loginAndGoHome(page);

    await page.getByRole("button", { name: "Démarrer un parcours" }).click();
    await expect(page.getByText("Suivi GPS")).toBeVisible();

    await page.getByRole("button", { name: "Refuser" }).click();
    await expect(page.getByText("Suivi GPS")).not.toBeVisible();
    // Should still be on landing page
    await expect(page.getByText("Démarrer un parcours")).toBeVisible();
  });
});
