# Sprint 3D Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add round summary screen (P0), PWA install prompt, and notification preferences to the Golfer PWA.

**Architecture:** Three independent features: (1) Round summary reads local scores from round-store after session ends, computes stats client-side. (2) PWA install captures `beforeinstallprompt` event via hook, shows dismissable banner on LandingPage. (3) Notification prefs stored in DB `notification_prefs` JSONB, exposed via new API endpoint, toggled in new ProfileScreen.

**Tech Stack:** React + Vite + Tailwind v4, Zustand stores, Vitest + testing-library, Fastify + Drizzle, shared types via `@golfix/shared`

---

### Task 1: Shared types for notification preferences

**Files:**
- Create: `packages/shared/src/types/preferences.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create preference types**

Create `packages/shared/src/types/preferences.ts`:

```ts
export interface NotificationPrefs {
  paceReminders: boolean;
}

export interface UpdatePrefsInput {
  paceReminders?: boolean;
}

export interface UserPrefsResponse {
  notificationPrefs: NotificationPrefs;
}
```

**Step 2: Export from shared index**

In `packages/shared/src/index.ts`, add after the socket exports:

```ts
export type {
  NotificationPrefs,
  UpdatePrefsInput,
  UserPrefsResponse,
} from "./types/preferences";
```

**Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/types/preferences.ts packages/shared/src/index.ts
git commit -m "feat: add shared notification preferences types"
```

---

### Task 2: API endpoint for user preferences

**Files:**
- Create: `apps/api/src/users/user-schemas.ts`
- Create: `apps/api/src/users/user-service.ts`
- Create: `apps/api/src/users/user-routes.ts`
- Create: `apps/api/src/users/__tests__/user-routes.test.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Write the failing test**

Create `apps/api/src/users/__tests__/user-routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import { db } from "../../db/client";
import { users } from "../../db/schema/core";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
const BASE = "/api/v1";

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "access" }, JWT_SECRET, { expiresIn: "15m" });
}

describe("User preference routes", () => {
  let app: FastifyInstance;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a test user
    const [user] = await db
      .insert(users)
      .values({
        displayName: "Test Prefs User",
        email: `prefs-${Date.now()}@test.com`,
        passwordHash: "unused",
      })
      .returning({ id: users.id });
    userId = user!.id;
    token = makeToken(userId);
  });

  describe("GET /users/me/preferences", () => {
    it("returns default preferences for new user", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.notificationPrefs).toEqual({ pace_reminders: true });
    });

    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/preferences`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("PATCH /users/me/preferences", () => {
    it("updates pace reminders to false", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
        payload: { paceReminders: false },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.notificationPrefs).toEqual({ pace_reminders: false });
    });

    it("persists preference change", async () => {
      // Update
      await app.inject({
        method: "PATCH",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
        payload: { paceReminders: false },
      });

      // Read back
      const res = await app.inject({
        method: "GET",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.json().notificationPrefs).toEqual({ pace_reminders: false });
    });

    it("rejects invalid payload", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/users/me/preferences`,
        headers: { authorization: `Bearer ${token}` },
        payload: { paceReminders: "not-a-boolean" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 401 without token", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${BASE}/users/me/preferences`,
        payload: { paceReminders: false },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm vitest run src/users/__tests__/user-routes.test.ts`
Expected: FAIL (modules not found)

**Step 3: Create schema**

Create `apps/api/src/users/user-schemas.ts`:

```ts
import { z } from "zod";

export const updatePrefsSchema = z.object({
  paceReminders: z.boolean().optional(),
});
```

**Step 4: Create service**

Create `apps/api/src/users/user-service.ts`:

```ts
import { db } from "../db/client";
import { users } from "../db/schema/core";
import { eq } from "drizzle-orm";
import type { UserPrefsResponse } from "@golfix/shared";

interface NotificationPrefsRow {
  pace_reminders: boolean;
}

const DEFAULT_PREFS: NotificationPrefsRow = { pace_reminders: true };

export async function getUserPreferences(userId: string): Promise<UserPrefsResponse> {
  const [user] = await db
    .select({ notificationPrefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, userId));

  const prefs = (user?.notificationPrefs as NotificationPrefsRow | null) ?? DEFAULT_PREFS;

  return { notificationPrefs: prefs };
}

export async function updateUserPreferences(
  userId: string,
  update: { paceReminders?: boolean },
): Promise<UserPrefsResponse> {
  const current = await getUserPreferences(userId);
  const currentPrefs = current.notificationPrefs as unknown as NotificationPrefsRow;

  const merged: NotificationPrefsRow = {
    pace_reminders: update.paceReminders ?? currentPrefs.pace_reminders,
  };

  await db.update(users).set({ notificationPrefs: merged }).where(eq(users.id, userId));

  return { notificationPrefs: merged };
}
```

**Step 5: Create routes**

Create `apps/api/src/users/user-routes.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { updatePrefsSchema } from "./user-schemas";
import { getUserPreferences, updateUserPreferences } from "./user-service";
import { verifyToken } from "../middleware/auth-middleware";

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifyToken);

  app.get("/users/me/preferences", {
    handler: async (request, reply) => {
      const result = await getUserPreferences(request.userId!);
      return reply.status(200).send(result);
    },
  });

  app.patch("/users/me/preferences", {
    handler: async (request, reply) => {
      const parsed = updatePrefsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      const result = await updateUserPreferences(request.userId!, parsed.data);
      return reply.status(200).send(result);
    },
  });
}
```

**Step 6: Register routes in app.ts**

In `apps/api/src/app.ts`, inside the API register callback (after scoring routes), add:

```ts
const { userRoutes } = await import("./users/user-routes");
await api.register(userRoutes);
```

Note: Like scoring routes, register WITHOUT prefix since paths already contain `/users/me/`.

**Step 7: Run tests**

Run: `cd apps/api && pnpm vitest run src/users/__tests__/user-routes.test.ts`
Expected: PASS (all 5 tests)

**Step 8: Commit**

```bash
git add apps/api/src/users/ apps/api/src/app.ts
git commit -m "feat: add user preferences API endpoint (GET/PATCH /users/me/preferences)"
```

---

### Task 3: Round summary — stats computation utility

**Files:**
- Create: `apps/golfer-app/src/features/summary/compute-stats.ts`
- Create: `apps/golfer-app/src/features/summary/__tests__/compute-stats.test.ts`

**Step 1: Write the failing test**

Create `apps/golfer-app/src/features/summary/__tests__/compute-stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeRoundStats, type RoundStats } from "../compute-stats";
import type { HoleData } from "@golfix/shared";
import type { LocalScore } from "@/stores/round-store";

function makeHole(num: number, par: number): HoleData {
  return {
    id: `h${num}`,
    holeNumber: num,
    par,
    strokeIndex: num,
    distanceMeters: 350,
    teePosition: null,
    greenCenter: null,
    greenFront: null,
    greenBack: null,
    paceTargetMinutes: null,
    transitionMinutes: 3,
    hazards: [],
  };
}

function makeScore(strokes: number, putts: number, fir: boolean | null, gir: boolean | null): LocalScore {
  return { strokes, putts, fairwayHit: fir, greenInRegulation: gir, synced: false };
}

describe("computeRoundStats", () => {
  it("computes totals for a complete 18-hole round", () => {
    const holes = Array.from({ length: 18 }, (_, i) => makeHole(i + 1, i < 4 ? 3 : 4));
    const scores = new Map<number, LocalScore>();
    // Par 3 holes: score 3
    for (let i = 1; i <= 4; i++) scores.set(i, makeScore(3, 2, null, true));
    // Par 4 holes: score 5
    for (let i = 5; i <= 18; i++) scores.set(i, makeScore(5, 2, true, false));

    const stats = computeRoundStats(scores, holes);

    expect(stats.totalStrokes).toBe(3 * 4 + 5 * 14); // 12 + 70 = 82
    expect(stats.totalPar).toBe(3 * 4 + 4 * 14); // 12 + 56 = 68
    expect(stats.vsPar).toBe(14);
    expect(stats.totalPutts).toBe(36);
    expect(stats.holesPlayed).toBe(18);
  });

  it("computes FIR percentage (only par 4+ holes)", () => {
    const holes = [makeHole(1, 3), makeHole(2, 4), makeHole(3, 4), makeHole(4, 5)];
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(3, 1, true, true)); // par 3 — FIR not counted
    scores.set(2, makeScore(4, 2, true, true));  // par 4, FIR hit
    scores.set(3, makeScore(5, 2, false, false)); // par 4, FIR miss
    scores.set(4, makeScore(5, 2, true, true));  // par 5, FIR hit

    const stats = computeRoundStats(scores, holes);

    // 2 FIR hits out of 3 par 4+ holes = 66.7%
    expect(stats.firPercent).toBeCloseTo(66.7, 0);
  });

  it("computes GIR percentage (all holes)", () => {
    const holes = [makeHole(1, 3), makeHole(2, 4), makeHole(3, 4)];
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(3, 1, null, true));
    scores.set(2, makeScore(4, 2, true, true));
    scores.set(3, makeScore(5, 2, true, false));

    const stats = computeRoundStats(scores, holes);

    // 2 GIR out of 3 holes = 66.7%
    expect(stats.girPercent).toBeCloseTo(66.7, 0);
  });

  it("handles null FIR/GIR as not counted", () => {
    const holes = [makeHole(1, 4), makeHole(2, 4)];
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(4, 2, true, null));  // FIR yes, GIR null
    scores.set(2, makeScore(4, 2, null, true));  // FIR null, GIR yes

    const stats = computeRoundStats(scores, holes);

    // FIR: 1 hit / 1 tracked = 100%
    expect(stats.firPercent).toBe(100);
    // GIR: 1 hit / 1 tracked = 100%
    expect(stats.girPercent).toBe(100);
  });

  it("returns zeros for empty scores", () => {
    const holes = [makeHole(1, 4)];
    const scores = new Map<number, LocalScore>();

    const stats = computeRoundStats(scores, holes);

    expect(stats.totalStrokes).toBe(0);
    expect(stats.holesPlayed).toBe(0);
    expect(stats.firPercent).toBeNull();
    expect(stats.girPercent).toBeNull();
  });

  it("builds per-hole breakdown", () => {
    const holes = [makeHole(1, 4), makeHole(2, 3)];
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(5, 2, true, false));
    scores.set(2, makeScore(3, 1, null, true));

    const stats = computeRoundStats(scores, holes);

    expect(stats.holeDetails).toHaveLength(2);
    expect(stats.holeDetails[0]).toEqual({
      holeNumber: 1,
      par: 4,
      strokes: 5,
      vsPar: 1,
      putts: 2,
      fairwayHit: true,
      greenInRegulation: false,
    });
    expect(stats.holeDetails[1]).toEqual({
      holeNumber: 2,
      par: 3,
      strokes: 3,
      vsPar: 0,
      putts: 1,
      fairwayHit: null,
      greenInRegulation: true,
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/golfer-app && pnpm vitest run src/features/summary/__tests__/compute-stats.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement compute-stats**

Create `apps/golfer-app/src/features/summary/compute-stats.ts`:

```ts
import type { HoleData } from "@golfix/shared";
import type { LocalScore } from "@/stores/round-store";

export interface HoleDetail {
  holeNumber: number;
  par: number;
  strokes: number;
  vsPar: number;
  putts: number;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
}

export interface RoundStats {
  totalStrokes: number;
  totalPar: number;
  vsPar: number;
  totalPutts: number;
  holesPlayed: number;
  firPercent: number | null;
  girPercent: number | null;
  holeDetails: HoleDetail[];
}

export function computeRoundStats(
  scores: Map<number, LocalScore>,
  holes: HoleData[],
): RoundStats {
  let totalStrokes = 0;
  let totalPar = 0;
  let totalPutts = 0;
  let holesPlayed = 0;
  let firHit = 0;
  let firTracked = 0;
  let girHit = 0;
  let girTracked = 0;
  const holeDetails: HoleDetail[] = [];

  for (const hole of holes) {
    const score = scores.get(hole.holeNumber);
    if (!score) continue;

    holesPlayed++;
    totalStrokes += score.strokes;
    totalPar += hole.par;
    totalPutts += score.putts;

    // FIR only counts on par 4+ holes where the golfer recorded a value
    if (hole.par >= 4 && score.fairwayHit !== null) {
      firTracked++;
      if (score.fairwayHit) firHit++;
    }

    // GIR counts on all holes where the golfer recorded a value
    if (score.greenInRegulation !== null) {
      girTracked++;
      if (score.greenInRegulation) girHit++;
    }

    holeDetails.push({
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokes: score.strokes,
      vsPar: score.strokes - hole.par,
      putts: score.putts,
      fairwayHit: score.fairwayHit,
      greenInRegulation: score.greenInRegulation,
    });
  }

  return {
    totalStrokes,
    totalPar,
    vsPar: totalStrokes - totalPar,
    totalPutts,
    holesPlayed,
    firPercent: firTracked > 0 ? (firHit / firTracked) * 100 : null,
    girPercent: girTracked > 0 ? (girHit / girTracked) * 100 : null,
    holeDetails,
  };
}
```

**Step 4: Run tests**

Run: `cd apps/golfer-app && pnpm vitest run src/features/summary/__tests__/compute-stats.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add apps/golfer-app/src/features/summary/
git commit -m "feat: add round stats computation utility"
```

---

### Task 4: Round summary screen UI

**Files:**
- Create: `apps/golfer-app/src/features/summary/StatsSummary.tsx`
- Create: `apps/golfer-app/src/features/summary/HoleBreakdown.tsx`
- Create: `apps/golfer-app/src/features/summary/RoundSummaryScreen.tsx`
- Create: `apps/golfer-app/src/features/summary/__tests__/RoundSummaryScreen.test.tsx`
- Modify: `apps/golfer-app/src/router.tsx`
- Modify: `apps/golfer-app/src/features/scorecard/ScorecardScreen.tsx`

**Step 1: Write the failing test**

Create `apps/golfer-app/src/features/summary/__tests__/RoundSummaryScreen.test.tsx`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CourseData, HoleData } from "@golfix/shared";
import type { LocalScore } from "@/stores/round-store";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockCourseData: CourseData | null = null;
vi.mock("@/stores/course-store", () => ({
  useCourseStore: vi.fn((selector: (s: { courseData: CourseData | null }) => unknown) =>
    selector({ courseData: mockCourseData }),
  ),
}));

const mockScores = new Map<number, LocalScore>();
const mockReset = vi.fn();
let mockRoundId: string | null = "r1";

vi.mock("@/stores/round-store", () => ({
  useRoundStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ scores: mockScores, roundId: mockRoundId, reset: mockReset }),
  ),
}));

const mockSessionReset = vi.fn();
vi.mock("@/stores/session-store", () => ({
  useSessionStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ reset: mockSessionReset }),
  ),
}));

const { RoundSummaryScreen } = await import("../RoundSummaryScreen");

function makeHole(num: number, par: number): HoleData {
  return {
    id: `h${num}`, holeNumber: num, par, strokeIndex: num, distanceMeters: 350,
    teePosition: null, greenCenter: null, greenFront: null, greenBack: null,
    paceTargetMinutes: null, transitionMinutes: 3, hazards: [],
  };
}

function makeScore(strokes: number, putts: number): LocalScore {
  return { strokes, putts, fairwayHit: null, greenInRegulation: null, synced: false };
}

describe("RoundSummaryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCourseData = null;
    mockScores.clear();
    mockRoundId = "r1";
  });

  afterEach(cleanup);

  it("redirects to / when no scores exist", () => {
    render(<MemoryRouter><RoundSummaryScreen /></MemoryRouter>);
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("shows total score and vs par", () => {
    mockCourseData = {
      id: "c1", name: "Test Golf", slug: "test", holesCount: 2, par: 7,
      paceTargetMinutes: 240, teeIntervalMinutes: 8, timezone: "Europe/Paris", dataVersion: 1,
      holes: [makeHole(1, 4), makeHole(2, 3)],
    };
    mockScores.set(1, makeScore(5, 2));
    mockScores.set(2, makeScore(3, 1));

    render(<MemoryRouter><RoundSummaryScreen /></MemoryRouter>);

    expect(screen.getByText("8")).toBeInTheDocument(); // total strokes
    expect(screen.getByText("+1")).toBeInTheDocument(); // vs par
  });

  it("shows per-hole breakdown", () => {
    mockCourseData = {
      id: "c1", name: "Test Golf", slug: "test", holesCount: 2, par: 7,
      paceTargetMinutes: 240, teeIntervalMinutes: 8, timezone: "Europe/Paris", dataVersion: 1,
      holes: [makeHole(1, 4), makeHole(2, 3)],
    };
    mockScores.set(1, makeScore(5, 2));
    mockScores.set(2, makeScore(3, 1));

    render(<MemoryRouter><RoundSummaryScreen /></MemoryRouter>);

    // Hole numbers visible
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("resets stores and navigates home on button click", () => {
    mockCourseData = {
      id: "c1", name: "Test Golf", slug: "test", holesCount: 1, par: 4,
      paceTargetMinutes: 240, teeIntervalMinutes: 8, timezone: "Europe/Paris", dataVersion: 1,
      holes: [makeHole(1, 4)],
    };
    mockScores.set(1, makeScore(4, 2));

    render(<MemoryRouter><RoundSummaryScreen /></MemoryRouter>);

    fireEvent.click(screen.getByText("Retour à l'accueil"));

    expect(mockReset).toHaveBeenCalled();
    expect(mockSessionReset).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/golfer-app && pnpm vitest run src/features/summary/__tests__/RoundSummaryScreen.test.ts`
Expected: FAIL

**Step 3: Create StatsSummary component**

Create `apps/golfer-app/src/features/summary/StatsSummary.tsx`:

```tsx
import type { RoundStats } from "./compute-stats";

interface StatsSummaryProps {
  stats: RoundStats;
}

function formatVsPar(vsPar: number): string {
  if (vsPar === 0) return "E";
  return vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)}%`;
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  const vsParColor =
    stats.vsPar === 0 ? "text-cream" : stats.vsPar < 0 ? "text-green-light" : "text-gold";

  return (
    <div className="flex flex-col gap-4">
      {/* Main score */}
      <div className="flex items-baseline justify-center gap-3">
        <span className="text-5xl font-bold text-cream">{stats.totalStrokes}</span>
        <span className={`text-2xl font-bold ${vsParColor}`}>{formatVsPar(stats.vsPar)}</span>
      </div>
      <p className="text-center text-sm text-cream/50">{stats.holesPlayed} trous joués</p>

      {/* Stat chips */}
      <div className="flex justify-center gap-3">
        <div className="rounded-lg bg-cream/5 px-4 py-2 text-center">
          <p className="text-xs text-cream/50">Putts</p>
          <p className="text-lg font-semibold text-cream">{stats.totalPutts}</p>
        </div>
        <div className="rounded-lg bg-cream/5 px-4 py-2 text-center">
          <p className="text-xs text-cream/50">FIR</p>
          <p className="text-lg font-semibold text-cream">{formatPercent(stats.firPercent)}</p>
        </div>
        <div className="rounded-lg bg-cream/5 px-4 py-2 text-center">
          <p className="text-xs text-cream/50">GIR</p>
          <p className="text-lg font-semibold text-cream">{formatPercent(stats.girPercent)}</p>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Create HoleBreakdown component**

Create `apps/golfer-app/src/features/summary/HoleBreakdown.tsx`:

```tsx
import type { HoleDetail } from "./compute-stats";

interface HoleBreakdownProps {
  holeDetails: HoleDetail[];
}

function vsParLabel(vsPar: number): string {
  if (vsPar === 0) return "E";
  return vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
}

function vsParColor(vsPar: number): string {
  if (vsPar < 0) return "text-green-light";
  if (vsPar > 0) return "text-gold";
  return "text-cream/70";
}

export function HoleBreakdown({ holeDetails }: HoleBreakdownProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cream/10 text-cream/50">
            <th className="py-2 text-left font-medium">Trou</th>
            <th className="py-2 text-center font-medium">Par</th>
            <th className="py-2 text-center font-medium">Score</th>
            <th className="py-2 text-center font-medium">+/−</th>
            <th className="py-2 text-center font-medium">Putts</th>
          </tr>
        </thead>
        <tbody>
          {holeDetails.map((h) => (
            <tr key={h.holeNumber} className="border-b border-cream/5">
              <td className="py-2 text-cream">{h.holeNumber}</td>
              <td className="py-2 text-center text-cream/60">{h.par}</td>
              <td className="py-2 text-center font-medium text-cream">{h.strokes}</td>
              <td className={`py-2 text-center font-medium ${vsParColor(h.vsPar)}`}>
                {vsParLabel(h.vsPar)}
              </td>
              <td className="py-2 text-center text-cream/60">{h.putts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 5: Create RoundSummaryScreen**

Create `apps/golfer-app/src/features/summary/RoundSummaryScreen.tsx`:

```tsx
import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCourseStore } from "@/stores/course-store";
import { useRoundStore } from "@/stores/round-store";
import { useSessionStore } from "@/stores/session-store";
import { computeRoundStats } from "./compute-stats";
import { StatsSummary } from "./StatsSummary";
import { HoleBreakdown } from "./HoleBreakdown";

export function RoundSummaryScreen() {
  const navigate = useNavigate();
  const courseData = useCourseStore((s) => s.courseData);
  const scores = useRoundStore((s) => s.scores);
  const roundReset = useRoundStore((s) => s.reset);
  const sessionReset = useSessionStore((s) => s.reset);

  // Redirect if no data
  useEffect(() => {
    if (scores.size === 0) {
      navigate("/", { replace: true });
    }
  }, [scores, navigate]);

  const handleGoHome = useCallback(() => {
    roundReset();
    sessionReset();
    navigate("/");
  }, [roundReset, sessionReset, navigate]);

  if (scores.size === 0 || !courseData) return null;

  const stats = computeRoundStats(scores, courseData.holes);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-6">
      <h1 className="text-center text-xl font-semibold text-cream">Résumé de la partie</h1>

      <StatsSummary stats={stats} />

      <HoleBreakdown holeDetails={stats.holeDetails} />

      <button
        type="button"
        onClick={handleGoHome}
        className="mt-auto w-full rounded-xl bg-green-mid py-4 text-lg font-semibold text-cream"
      >
        Retour à l'accueil
      </button>
    </div>
  );
}
```

**Step 6: Add route to router.tsx**

In `apps/golfer-app/src/router.tsx`:

Add import at top:
```ts
import { RoundSummaryScreen } from "@/features/summary/RoundSummaryScreen";
```

Add route inside protected children (after `/scorecard`):
```tsx
{
  path: "/summary",
  element: (
    <AppShell>
      <RoundSummaryScreen />
    </AppShell>
  ),
},
```

**Step 7: Update ScorecardScreen to navigate to /summary**

In `apps/golfer-app/src/features/scorecard/ScorecardScreen.tsx`, change `handleFinish`:

Replace `navigate("/")` with `navigate("/summary")`.

The full updated handler:
```ts
const handleFinish = useCallback(async () => {
  const confirmed = window.confirm("Terminer la partie ?");
  if (!confirmed) return;

  // Save current hole before finishing
  await saveScore(currentHole);
  await finishSession("finished");
  if (useSessionStore.getState().status === "ended") {
    navigate("/summary");
  }
}, [currentHole, saveScore, finishSession, navigate]);
```

Note: Also add `saveScore` and `currentHole` to the dependency list since we now call `saveScore(currentHole)` before finishing.

**Step 8: Update ScorecardScreen test**

In `apps/golfer-app/src/features/scorecard/__tests__/ScorecardScreen.test.tsx`, the "calls finishSession and navigates on confirm" test should now expect `navigate("/summary")` instead of `navigate("/")`.

**Step 9: Run tests**

Run: `cd apps/golfer-app && pnpm vitest run src/features/summary/ src/features/scorecard/__tests__/ScorecardScreen.test.tsx`
Expected: PASS

**Step 10: Commit**

```bash
git add apps/golfer-app/src/features/summary/ apps/golfer-app/src/router.tsx apps/golfer-app/src/features/scorecard/ScorecardScreen.tsx apps/golfer-app/src/features/scorecard/__tests__/ScorecardScreen.test.tsx
git commit -m "feat: add round summary screen with stats and per-hole breakdown"
```

---

### Task 5: PWA install prompt

**Files:**
- Create: `apps/golfer-app/src/hooks/use-install-prompt.ts`
- Create: `apps/golfer-app/src/components/InstallBanner.tsx`
- Create: `apps/golfer-app/src/hooks/__tests__/use-install-prompt.test.ts`
- Create: `apps/golfer-app/src/components/__tests__/InstallBanner.test.tsx`
- Modify: `apps/golfer-app/src/features/session/LandingPage.tsx`

**Step 1: Write the failing hook test**

Create `apps/golfer-app/src/hooks/__tests__/use-install-prompt.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useInstallPrompt } from "../use-install-prompt";

afterEach(cleanup);

describe("useInstallPrompt", () => {
  it("canInstall is false initially", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it("canInstall becomes true after beforeinstallprompt fires", () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      const event = new Event("beforeinstallprompt") as Event & { preventDefault: () => void };
      window.dispatchEvent(event);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it("promptInstall calls prompt() on the captured event", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockPrompt = vi.fn().mockResolvedValue({ outcome: "accepted" });
    act(() => {
      const event = Object.assign(new Event("beforeinstallprompt"), {
        prompt: mockPrompt,
        preventDefault: vi.fn(),
      });
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/golfer-app && pnpm vitest run src/hooks/__tests__/use-install-prompt.test.ts`
Expected: FAIL

**Step 3: Implement the hook**

Create `apps/golfer-app/src/hooks/use-install-prompt.ts`:

```ts
import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const eventRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      eventRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!eventRef.current) return;
    await eventRef.current.prompt();
    eventRef.current = null;
    setCanInstall(false);
  }, []);

  return { canInstall, promptInstall };
}
```

**Step 4: Run hook test**

Run: `cd apps/golfer-app && pnpm vitest run src/hooks/__tests__/use-install-prompt.test.ts`
Expected: PASS

**Step 5: Write the failing banner test**

Create `apps/golfer-app/src/components/__tests__/InstallBanner.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { InstallBanner } from "../InstallBanner";

describe("InstallBanner", () => {
  const mockOnInstall = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("renders install message and buttons", () => {
    render(<InstallBanner onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    expect(screen.getByText("Installer Golfix")).toBeInTheDocument();
    expect(screen.getByText("Installer")).toBeInTheDocument();
  });

  it("calls onInstall when install button is clicked", () => {
    render(<InstallBanner onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    fireEvent.click(screen.getByText("Installer"));
    expect(mockOnInstall).toHaveBeenCalled();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    render(<InstallBanner onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
```

**Step 6: Implement InstallBanner**

Create `apps/golfer-app/src/components/InstallBanner.tsx`:

```tsx
interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-cream/10 px-4 py-3">
      <p className="flex-1 text-sm font-medium text-cream">Installer Golfix</p>
      <button
        type="button"
        onClick={onInstall}
        className="rounded-lg bg-green-mid px-4 py-2 text-sm font-medium text-cream"
      >
        Installer
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer"
        className="text-cream/50"
      >
        ✕
      </button>
    </div>
  );
}
```

**Step 7: Run banner test**

Run: `cd apps/golfer-app && pnpm vitest run src/components/__tests__/InstallBanner.test.tsx`
Expected: PASS

**Step 8: Wire into LandingPage**

In `apps/golfer-app/src/features/session/LandingPage.tsx`:

Add imports:
```ts
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { InstallBanner } from "@/components/InstallBanner";
```

Add state inside `LandingPage()`:
```ts
const { canInstall, promptInstall } = useInstallPrompt();
const [installDismissed, setInstallDismissed] = useState(
  () => localStorage.getItem("golfix-install-dismissed") === "true",
);

function handleDismissInstall() {
  setInstallDismissed(true);
  localStorage.setItem("golfix-install-dismissed", "true");
}
```

Add banner JSX after the "Démarrer un parcours" button and locateMessage, before the rounds section:
```tsx
{canInstall && !installDismissed && (
  <div className="mt-4">
    <InstallBanner onInstall={promptInstall} onDismiss={handleDismissInstall} />
  </div>
)}
```

**Step 9: Run all tests**

Run: `cd apps/golfer-app && pnpm vitest run`
Expected: PASS

**Step 10: Commit**

```bash
git add apps/golfer-app/src/hooks/use-install-prompt.ts apps/golfer-app/src/hooks/__tests__/use-install-prompt.test.ts apps/golfer-app/src/components/InstallBanner.tsx apps/golfer-app/src/components/__tests__/InstallBanner.test.tsx apps/golfer-app/src/features/session/LandingPage.tsx
git commit -m "feat: add PWA install prompt with dismissable banner"
```

---

### Task 6: Profile screen with notification preferences

**Files:**
- Create: `apps/golfer-app/src/features/profile/ProfileScreen.tsx`
- Create: `apps/golfer-app/src/features/profile/__tests__/ProfileScreen.test.tsx`
- Modify: `apps/golfer-app/src/router.tsx`

**Step 1: Write the failing test**

Create `apps/golfer-app/src/features/profile/__tests__/ProfileScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthUser } from "@golfix/shared";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockUser: AuthUser | null = null;
const mockLogout = vi.fn();

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: mockUser, logout: mockLogout }),
  ),
}));

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock("@/services/api-client", () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args), patch: (...args: unknown[]) => mockPatch(...args) },
  ApiError: class extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

const { ProfileScreen } = await import("../ProfileScreen");

function renderProfile() {
  return render(<MemoryRouter><ProfileScreen /></MemoryRouter>);
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "u1", displayName: "Jean Dupont", email: "jean@test.com" };
    mockGet.mockResolvedValue({ notificationPrefs: { pace_reminders: true } });
    mockPatch.mockResolvedValue({ notificationPrefs: { pace_reminders: false } });
  });

  afterEach(cleanup);

  it("shows user display name", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    });
  });

  it("loads and shows notification preference", async () => {
    renderProfile();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/users/me/preferences");
    });
  });

  it("toggles pace reminders on click", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/users/me/preferences", {
        paceReminders: false,
      });
    });
  });

  it("calls logout and navigates on logout click", () => {
    renderProfile();

    fireEvent.click(screen.getByText("Se déconnecter"));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/golfer-app && pnpm vitest run src/features/profile/__tests__/ProfileScreen.test.tsx`
Expected: FAIL

**Step 3: Implement ProfileScreen**

Create `apps/golfer-app/src/features/profile/ProfileScreen.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/api-client";
import type { UserPrefsResponse } from "@golfix/shared";

export function ProfileScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [paceReminders, setPaceReminders] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;

    apiClient
      .get<UserPrefsResponse>("/users/me/preferences")
      .then((data) => {
        if (stale) return;
        setPaceReminders(data.notificationPrefs.pace_reminders);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (stale) return;
        console.warn("Failed to load preferences:", err);
        setLoading(false);
      });

    return () => {
      stale = true;
    };
  }, []);

  const handleToggle = useCallback(async () => {
    const newValue = !paceReminders;
    setPaceReminders(newValue); // optimistic

    try {
      await apiClient.patch<UserPrefsResponse>("/users/me/preferences", {
        paceReminders: newValue,
      });
    } catch (err: unknown) {
      console.warn("Failed to update preferences:", err);
      setPaceReminders(!newValue); // revert
    }
  }, [paceReminders]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-6">
      <h1 className="text-xl font-semibold text-cream">Profil</h1>

      {/* User info */}
      <div className="rounded-xl bg-cream/5 px-4 py-3">
        <p className="text-lg font-medium text-cream">{user?.displayName ?? "—"}</p>
        {user?.email && <p className="text-sm text-cream/50">{user.email}</p>}
      </div>

      {/* Notification prefs */}
      <div className="rounded-xl bg-cream/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-cream">Rappels de rythme</p>
            <p className="text-xs text-cream/50">Notifications pendant la partie</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={paceReminders}
            disabled={loading}
            onClick={handleToggle}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              paceReminders ? "bg-green-mid" : "bg-cream/20"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-cream transition-transform ${
                paceReminders ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className="mt-auto mb-8 w-full rounded-xl border border-cream/20 py-3 text-sm font-medium text-cream/70"
      >
        Se déconnecter
      </button>
    </div>
  );
}
```

**Step 4: Update router.tsx**

In `apps/golfer-app/src/router.tsx`:

Replace `ProfilePlaceholder` import and definition with:
```ts
import { ProfileScreen } from "@/features/profile/ProfileScreen";
```

Remove the `ProfilePlaceholder` function.

Update the `/profile` route to use `<ProfileScreen />`.

**Step 5: Run tests**

Run: `cd apps/golfer-app && pnpm vitest run src/features/profile/__tests__/ProfileScreen.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/golfer-app/src/features/profile/ apps/golfer-app/src/router.tsx
git commit -m "feat: add profile screen with notification preferences toggle"
```

---

### Task 7: Validation and final checks

**Step 1: Run full validation**

Run: `pnpm validate`
Expected: lint + format + typecheck + build all PASS

**Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests PASS

**Step 3: Run E2E tests**

Run: `cd apps/golfer-app && pnpm test:e2e`
Expected: All 30+ tests PASS

**Step 4: Update PLAN.md and CLAUDE.md**

Update "Current sprint" / "Last completed task" in both PLAN.md and CLAUDE.md:
- Last completed task: 3.15 Notification preferences (Sprint 3D complete)
- Next: Sprint 3E (3.16 UI polish + 3.17 Device testing) or Sprint 5

**Step 5: Final commit**

```bash
git add PLAN.md CLAUDE.md
git commit -m "docs: update sprint progress — Sprint 3D complete"
```
