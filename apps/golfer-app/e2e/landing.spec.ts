import { test, expect } from "./fixtures";

test.describe("Landing page", () => {
  /** Helper: login and navigate to landing page */
  async function loginAndGoHome(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@golfix.fr");
    await page.getByLabel("Mot de passe").fill("password123");
    await page.getByRole("button", { name: "Connexion" }).click();
    await expect(page).toHaveURL(/\/gps/);

    // Navigate to home (landing) via SPA navigation
    await page.evaluate(() => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByText("Démarrer un parcours")).toBeVisible({ timeout: 5000 });
  }

  test("shows welcome message with user name", async ({ page }) => {
    await loginAndGoHome(page);
    await expect(page.getByText(/Bienvenue.*Jean Test/)).toBeVisible();
  });

  test("shows past rounds", async ({ page }) => {
    await loginAndGoHome(page);
    await expect(page.getByText("Dernières parties")).toBeVisible();
    await expect(page.getByText("82")).toBeVisible();
    await expect(page.getByText("78")).toBeVisible();
  });

  test("shows start button", async ({ page }) => {
    await loginAndGoHome(page);
    await expect(page.getByRole("button", { name: "Démarrer un parcours" })).toBeVisible();
  });
});
