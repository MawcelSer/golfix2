import { test, expect } from "./fixtures";

test.describe("Auth Guard", () => {
  test("redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /gps to /login when not authenticated", async ({ page }) => {
    await page.goto("/gps");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Login flow", () => {
  test("shows login form with correct fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connexion" })).toBeVisible();
  });

  test("navigates to /gps after successful login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@golfix.fr");
    await page.getByLabel("Mot de passe").fill("password123");
    await page.getByRole("button", { name: "Connexion" }).click();

    await expect(page).toHaveURL(/\/gps/);
  });

  test("shows error on failed login", async ({ page }) => {
    // Override mock to return error
    await page.route("**/api/v1/auth/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email ou mot de passe incorrect" }),
      }),
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@email.com");
    await page.getByLabel("Mot de passe").fill("wrong");
    await page.getByRole("button", { name: "Connexion" }).click();

    await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
  });

  test("has link to register page", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Créer un compte" }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("has link to anonymous page", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Continuer sans compte" }).click();
    await expect(page).toHaveURL(/\/anonymous/);
  });
});

test.describe("Register flow", () => {
  test("shows register form with correct fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
    await expect(page.getByLabel("Nom")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
  });

  test("navigates to /gps after successful registration", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nom").fill("Jean Test");
    await page.getByLabel("Email").fill("test@golfix.fr");
    await page.getByLabel("Mot de passe").fill("password123");
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page).toHaveURL(/\/gps/);
  });

  test("has link back to login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Anonymous flow", () => {
  test("shows anonymous form with name field", async ({ page }) => {
    await page.goto("/anonymous");
    await expect(page.getByRole("heading", { name: "Jouer sans compte" })).toBeVisible();
    await expect(page.getByLabel(/nom/i)).toBeVisible();
  });

  test("navigates to /gps after anonymous auth", async ({ page }) => {
    await page.goto("/anonymous");
    await page.getByLabel(/nom/i).fill("Joueur Anonyme");
    await page.getByRole("button", { name: "Continuer" }).click();

    await expect(page).toHaveURL(/\/gps/);
  });
});

test.describe("Post-auth navigation", () => {
  test("shows bottom tabs after login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@golfix.fr");
    await page.getByLabel("Mot de passe").fill("password123");
    await page.getByRole("button", { name: "Connexion" }).click();

    await expect(page).toHaveURL(/\/gps/);
    await expect(page.getByRole("link", { name: "GPS" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Carte" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Profil" })).toBeVisible();
  });

  test("can navigate between tabs", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@golfix.fr");
    await page.getByLabel("Mot de passe").fill("password123");
    await page.getByRole("button", { name: "Connexion" }).click();
    await expect(page).toHaveURL(/\/gps/);

    // Navigate to scorecard
    await page.getByRole("link", { name: "Carte" }).click();
    await expect(page).toHaveURL(/\/scorecard/);
    await expect(page.getByText("Aucun parcours sélectionné")).toBeVisible();

    // Navigate to profile
    await page.getByRole("link", { name: "Profil" }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByText("Profile Screen")).toBeVisible();
  });
});
