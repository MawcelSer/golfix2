import { test as base, type Page } from "@playwright/test";

/** Mock auth response matching AuthResponse from @golfix/shared */
export const MOCK_AUTH = {
  user: {
    id: "user-1",
    email: "test@golfix.fr",
    displayName: "Jean Test",
    role: "player" as const,
  },
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
};

export const MOCK_ROUNDS = [
  { id: "r1", startedAt: "2026-02-15T09:00:00Z", computedTotalStrokes: 82 },
  { id: "r2", startedAt: "2026-02-10T14:00:00Z", computedTotalStrokes: 78 },
];

export const MOCK_COURSE_MATCH = {
  courseId: "course-1",
  slug: "royal-golf-marrakech",
  name: "Royal Golf Marrakech",
};

/** Intercept all /api/v1 calls with appropriate mock responses. */
export async function mockApi(page: Page) {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUTH),
    }),
  );

  await page.route("**/api/v1/auth/register", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUTH),
    }),
  );

  await page.route("**/api/v1/auth/anonymous", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUTH),
    }),
  );

  await page.route("**/api/v1/users/me/rounds", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ROUNDS),
    }),
  );

  await page.route("**/api/v1/courses/locate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_COURSE_MATCH),
    }),
  );
}

/** Set auth tokens in Zustand store via browser context to bypass login. */
export async function loginViaStore(page: Page) {
  await page.evaluate((auth) => {
    // Access Zustand store internals via the global store API
    // The store is exposed on the module scope — we set localStorage-like state
    // Since Zustand is in-memory only (no persistence yet), we inject via window
    (window as unknown as Record<string, unknown>).__GOLFIX_TEST_AUTH__ = auth;
  }, MOCK_AUTH);
}

/**
 * Extended test fixture that sets up API mocks before each test.
 * Use this instead of the default `test` import.
 */
export const test = base.extend<{ mockApiRoutes: void }>({
  mockApiRoutes: [
    async ({ page }, use) => {
      await mockApi(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
