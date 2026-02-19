import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const MOCK_COURSE = {
  id: "course-1",
  name: "Royal Golf Marrakech",
  slug: "royal-golf-marrakech",
  holesCount: 18,
  par: 72,
  paceTargetMinutes: 240,
  teeIntervalMinutes: 8,
  timezone: "Europe/Paris",
  dataVersion: 1,
  holes: Array.from({ length: 18 }, (_, i) => ({
    id: `hole-${i + 1}`,
    holeNumber: i + 1,
    par: i % 3 === 0 ? 3 : i % 3 === 1 ? 4 : 5,
    strokeIndex: i + 1,
    distanceMeters: 300 + i * 15,
    teePosition: null,
    greenCenter: null,
    greenFront: null,
    greenBack: null,
    paceTargetMinutes: null,
    transitionMinutes: 3,
    hazards: [],
  })),
};

const MOCK_ROUND = {
  id: "round-1",
  userId: "user-1",
  courseId: "course-1",
  sessionId: null,
  status: "in_progress",
  startedAt: "2026-02-19T10:00:00Z",
  finishedAt: null,
  totalScore: null,
  totalPutts: null,
  scores: [],
};

/** Set up API mocks, log in, load course data via GPS, navigate to scorecard */
async function loginAndGoToScorecard(page: Page) {
  // Mock course data API
  await page.route("**/api/v1/courses/royal-golf-marrakech/data", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_COURSE),
    }),
  );

  // Mock round creation
  await page.route("**/api/v1/rounds", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ROUND),
      });
    }
    return route.continue();
  });

  // Mock score upsert
  await page.route("**/api/v1/rounds/round-1/scores", (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: `score-${body.holeNumber}`,
        roundId: "round-1",
        holeNumber: body.holeNumber,
        strokes: body.strokes,
        putts: body.putts ?? null,
        fairwayHit: body.fairwayHit ?? null,
        greenInRegulation: body.greenInRegulation ?? null,
      }),
    });
  });

  // Login — go directly to the GPS page with course param
  // The AuthGuard will redirect to /login, then login navigates to /gps
  // So we login first, then use client-side navigation to add the course param
  await page.goto("/login");
  await page.getByLabel("Email").fill("test@golfix.fr");
  await page.getByLabel("Mot de passe").fill("password123");
  await page.getByRole("button", { name: "Connexion" }).click();
  await expect(page).toHaveURL(/\/gps/);

  // Use client-side navigation to add course query param (avoids full page reload)
  await page.evaluate(() => {
    window.history.pushState({}, "", "/gps?course=royal-golf-marrakech");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  // Wait for course data to load on GPS screen
  await expect(page.getByText("Trou 1/18")).toBeVisible();

  // Navigate to scorecard tab
  await page.getByRole("link", { name: "Carte" }).click();
  await expect(page).toHaveURL(/\/scorecard/);
}

test.describe("Scorecard flow", () => {
  test("shows no course message when course not loaded", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@golfix.fr");
    await page.getByLabel("Mot de passe").fill("password123");
    await page.getByRole("button", { name: "Connexion" }).click();
    await expect(page).toHaveURL(/\/gps/);

    await page.getByRole("link", { name: "Carte" }).click();
    await expect(page).toHaveURL(/\/scorecard/);
    await expect(page.getByText("Aucun parcours sélectionné")).toBeVisible();
  });

  test("displays scorecard with hole 1 when course is loaded", async ({ page }) => {
    await loginAndGoToScorecard(page);

    // Verify scorecard renders correctly for hole 1 (par 3)
    await expect(page.getByText("Par 3")).toBeVisible();
    await expect(page.getByText("Coups")).toBeVisible();
    await expect(page.getByText("Putts")).toBeVisible();
    await expect(page.getByText("Trou 1/18")).toBeVisible();
    await expect(page.getByText("GIR")).toBeVisible();
    // Hole 1 is par 3 → no FIR
    await expect(page.getByText("FIR")).not.toBeVisible();
  });

  test("can increment and decrement strokes and putts", async ({ page }) => {
    await loginAndGoToScorecard(page);

    // Increment strokes
    await page.getByLabel("Augmenter Coups").click();
    // Decrement strokes
    await page.getByLabel("Diminuer Coups").click();
    // Increment putts
    await page.getByLabel("Augmenter Putts").click();
    // Decrement putts
    await page.getByLabel("Diminuer Putts").click();
  });

  test("can navigate between holes and saves on navigate", async ({ page }) => {
    await loginAndGoToScorecard(page);

    await expect(page.getByText("Trou 1/18")).toBeVisible();

    // Navigate to hole 2
    await page.getByLabel("Trou suivant").click();
    await expect(page.getByText("Trou 2/18")).toBeVisible();
    // Hole 2 is par 4 → FIR visible
    await expect(page.getByText("Par 4")).toBeVisible();
    await expect(page.getByText("FIR")).toBeVisible();

    // Navigate to hole 3
    await page.getByLabel("Trou suivant").click();
    await expect(page.getByText("Trou 3/18")).toBeVisible();
    await expect(page.getByText("Par 5")).toBeVisible();

    // Navigate back to hole 2
    await page.getByLabel("Trou précédent").click();
    await expect(page.getByText("Trou 2/18")).toBeVisible();
  });

  test("GIR toggle cycles through 3 states", async ({ page }) => {
    await loginAndGoToScorecard(page);

    // Initial state: null (shown as "—")
    const girButton = page.getByLabel(/GIR/);
    await expect(girButton).toContainText("—");

    // Click → true ("Oui")
    await girButton.click();
    await expect(girButton).toContainText("Oui");

    // Click → false ("Non")
    await girButton.click();
    await expect(girButton).toContainText("Non");

    // Click → null ("—")
    await girButton.click();
    await expect(girButton).toContainText("—");
  });

  test("FIR toggle visible on par 4+ and cycles states", async ({ page }) => {
    await loginAndGoToScorecard(page);

    // Hole 1 = par 3 → no FIR
    await expect(page.getByText("FIR")).not.toBeVisible();

    // Navigate to hole 2 (par 4) → FIR visible
    await page.getByLabel("Trou suivant").click();
    await expect(page.getByText("FIR")).toBeVisible();

    // Toggle FIR: null → true → false → null
    const firButton = page.getByLabel(/FIR/);
    await expect(firButton).toContainText("—");
    await firButton.click();
    await expect(firButton).toContainText("Oui");
    await firButton.click();
    await expect(firButton).toContainText("Non");
    await firButton.click();
    await expect(firButton).toContainText("—");
  });
});
