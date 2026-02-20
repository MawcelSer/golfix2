import { test as base, type Page } from "@playwright/test";

export const MOCK_AUTH = {
  user: {
    id: "user-mgr-1",
    email: "manager@golfix.fr",
    displayName: "Marie Manager",
    role: "player" as const,
  },
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
};

export const MOCK_MANAGED_COURSES = [
  {
    id: "course-1",
    name: "Golf de Fontainebleau",
    slug: "golf-de-fontainebleau",
    holesCount: 18,
    par: 72,
    role: "owner",
  },
  {
    id: "course-2",
    name: "Golf de Chantilly",
    slug: "golf-de-chantilly",
    holesCount: 9,
    par: 36,
    role: "marshal",
  },
];

function makeHole(num: number, par: number) {
  return {
    id: `h${num}`,
    holeNumber: num,
    par,
    strokeIndex: num,
    distanceMeters: 350 + num * 10,
    teePosition: { x: 2.68, y: 48.41 },
    greenCenter: { x: 2.681, y: 48.412 },
    greenFront: { x: 2.6808, y: 48.4118 },
    greenBack: { x: 2.6812, y: 48.4122 },
    paceTargetMinutes: null,
    transitionMinutes: 3,
    hazards: [],
  };
}

export const MOCK_COURSE_DATA = {
  id: "course-1",
  name: "Golf de Fontainebleau",
  slug: "golf-de-fontainebleau",
  holesCount: 18,
  par: 72,
  paceTargetMinutes: 240,
  teeIntervalMinutes: 8,
  timezone: "Europe/Paris",
  dataVersion: 1,
  holes: Array.from({ length: 18 }, (_, i) => makeHole(i + 1, i % 2 === 0 ? 4 : 3)),
};

export const MOCK_DAILY_REPORT = {
  date: "2026-02-20",
  courseId: "course-1",
  rounds: { total: 16, completed: 12, avgDurationMinutes: 235 },
  sessions: { total: 60, active: 8, finished: 52 },
  paceEvents: {
    total: 3,
    byType: { behind_pace: 2, reminder_sent: 1 },
    bySeverity: { warning: 2, info: 1 },
  },
  interventions: 1,
};

/** Intercept all API calls with mock responses for dashboard. */
export async function mockApi(page: Page) {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUTH),
    }),
  );

  await page.route("**/api/v1/courses/managed", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_MANAGED_COURSES),
    }),
  );

  await page.route("**/api/v1/courses/by-id/*/data", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_COURSE_DATA),
    }),
  );

  await page.route("**/api/v1/courses/*/reports/daily/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DAILY_REPORT),
    }),
  );

  await page.route("**/api/v1/courses/*/reminders/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sent: true, recipientCount: 2, eventId: "evt-1" }),
    }),
  );
}

/** Inject auth tokens into localStorage to bypass login. */
export async function loginViaStorage(page: Page) {
  // Must be on the correct origin before setting localStorage
  await page.goto("/");
  await page.evaluate((auth) => {
    localStorage.setItem(
      "golfix-dashboard-auth",
      JSON.stringify({
        state: {
          user: auth.user,
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
        },
        version: 0,
      }),
    );
  }, MOCK_AUTH);
}

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
