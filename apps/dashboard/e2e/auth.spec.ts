import { test, expect } from "./fixtures";

test.describe("Login", () => {
  test("shows login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /golfix dashboard/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
  });

  test("logs in and redirects to course list", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("manager@golfix.fr");
    await page.getByLabel(/mot de passe/i).fill("password123");
    await page.getByRole("button", { name: /connexion/i }).click();

    // Should redirect to course list (RoleGuard fetches managed courses)
    await expect(page.getByText("Golf de Fontainebleau")).toBeVisible({ timeout: 5000 });
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
