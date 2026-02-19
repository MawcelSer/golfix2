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

function makeHole(num: number, par: number) {
  return {
    id: `h${num}`,
    holeNumber: num,
    par,
    strokeIndex: num,
    distanceMeters: 350 + num * 10,
    teePosition: { x: -8.025, y: 31.633 },
    greenCenter: { x: -8.023, y: 31.635 },
    greenFront: { x: -8.0232, y: 31.6348 },
    greenBack: { x: -8.0228, y: 31.6352 },
    paceTargetMinutes: null,
    transitionMinutes: 3,
    hazards: [],
  };
}

export const MOCK_COURSE_DATA = {
  id: "course-1",
  name: "Royal Golf Marrakech",
  slug: "royal-golf-marrakech",
  holesCount: 18,
  par: 72,
  paceTargetMinutes: 240,
  teeIntervalMinutes: 8,
  timezone: "Africa/Casablanca",
  dataVersion: 1,
  holes: Array.from({ length: 18 }, (_, i) => makeHole(i + 1, i % 2 === 0 ? 4 : 3)),
};

export const MOCK_SESSION_START = {
  sessionId: "session-1",
  groupId: "group-1",
  courseId: "course-1",
};

export const MOCK_SESSION_FINISH = {
  id: "session-1",
  userId: "user-1",
  courseId: "course-1",
  groupId: "group-1",
  status: "finished",
  startedAt: "2026-02-19T10:00:00Z",
  finishedAt: "2026-02-19T14:00:00Z",
  currentHole: 18,
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

  await page.route("**/api/v1/courses/*/data", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_COURSE_DATA),
    }),
  );

  await page.route("**/api/v1/sessions/start", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION_START),
    }),
  );

  await page.route("**/api/v1/sessions/*/finish", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION_FINISH),
    }),
  );

  await page.route("**/api/v1/positions/batch", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ processed: 0 }),
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
