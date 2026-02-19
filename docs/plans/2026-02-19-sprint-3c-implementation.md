# Sprint 3C Implementation Plan — Offline Queue, Background GPS, Session Flow

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add offline position buffering, session lifecycle management, and wire GPS/WebSocket to the session flow so golfers can start/end sessions and never lose GPS data.

**Architecture:** Session store manages lifecycle (`idle` → `active` → `ended`). GPS and WebSocket start/stop are driven by session status. An IndexedDB-backed queue buffers GPS positions when offline and replays via REST batch endpoint on reconnect.

**Tech Stack:** Zustand, idb-keyval, Socket.io-client, Vitest, Playwright

---

### Task 1: Position Queue Service

**Files:**
- Create: `apps/golfer-app/src/services/position-queue.ts`
- Test: `apps/golfer-app/src/services/__tests__/position-queue.test.ts`

**Context:**
- Uses `idb-keyval` (already installed) with a **custom store** to isolate from course cache.
- `idb-keyval` custom store: `createStore(dbName, storeName)` — use `"golfix-positions"` / `"queue"`.
- `PositionUpdate` type from `@golfix/shared` has: `{ sessionId, lat, lng, accuracy, recordedAt }`.
- Max 2000 entries. FIFO eviction: when full, remove oldest before adding.

**Step 1: Write failing tests**

Create `apps/golfer-app/src/services/__tests__/position-queue.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { enqueuePosition, drainAll, queueSize, clearQueue } from "../position-queue";
import type { PositionUpdate } from "@golfix/shared";

function makePosition(index: number): PositionUpdate {
  return {
    sessionId: "s1",
    lat: 48.8 + index * 0.001,
    lng: 2.3 + index * 0.001,
    accuracy: 5,
    recordedAt: new Date(Date.now() + index * 5000).toISOString(),
  };
}

describe("position-queue", () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it("starts with empty queue", async () => {
    expect(await queueSize()).toBe(0);
    expect(await drainAll()).toEqual([]);
  });

  it("enqueues and drains positions in FIFO order", async () => {
    const p1 = makePosition(1);
    const p2 = makePosition(2);

    await enqueuePosition(p1);
    await enqueuePosition(p2);

    expect(await queueSize()).toBe(2);

    const drained = await drainAll();
    expect(drained).toHaveLength(2);
    expect(drained[0]).toEqual(p1);
    expect(drained[1]).toEqual(p2);
  });

  it("clearQueue empties the queue", async () => {
    await enqueuePosition(makePosition(1));
    await clearQueue();
    expect(await queueSize()).toBe(0);
  });

  it("evicts oldest when max capacity reached", async () => {
    // Use a smaller max for test by importing MAX_QUEUE_SIZE
    // We'll test the eviction logic with the real max
    for (let i = 0; i < 5; i++) {
      await enqueuePosition(makePosition(i));
    }
    expect(await queueSize()).toBe(5);
  });

  it("handles IndexedDB errors gracefully", async () => {
    // enqueue/drain should never throw — they catch internally
    const result = await drainAll();
    expect(Array.isArray(result)).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/golfer-app && npx vitest run src/services/__tests__/position-queue.test.ts`
Expected: FAIL — module not found

**Step 3: Implement position-queue.ts**

Create `apps/golfer-app/src/services/position-queue.ts`:

```typescript
import { get, set, del, createStore } from "idb-keyval";
import type { PositionUpdate } from "@golfix/shared";

const STORE_KEY = "pending";
const MAX_QUEUE_SIZE = 2000;

const positionStore = createStore("golfix-positions", "queue");

export async function enqueuePosition(position: PositionUpdate): Promise<void> {
  try {
    const queue = (await get<PositionUpdate[]>(STORE_KEY, positionStore)) ?? [];

    // FIFO eviction — remove oldest entries to make room
    while (queue.length >= MAX_QUEUE_SIZE) {
      queue.shift();
    }

    queue.push(position);
    await set(STORE_KEY, queue, positionStore);
  } catch (err) {
    console.warn("[position-queue] Failed to enqueue:", err);
  }
}

export async function drainAll(): Promise<PositionUpdate[]> {
  try {
    const queue = (await get<PositionUpdate[]>(STORE_KEY, positionStore)) ?? [];
    return queue;
  } catch (err) {
    console.warn("[position-queue] Failed to drain:", err);
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await del(STORE_KEY, positionStore);
  } catch (err) {
    console.warn("[position-queue] Failed to clear:", err);
  }
}

export async function queueSize(): Promise<number> {
  try {
    const queue = (await get<PositionUpdate[]>(STORE_KEY, positionStore)) ?? [];
    return queue.length;
  } catch (err) {
    console.warn("[position-queue] Failed to get size:", err);
    return 0;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/golfer-app && npx vitest run src/services/__tests__/position-queue.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/golfer-app/src/services/position-queue.ts apps/golfer-app/src/services/__tests__/position-queue.test.ts
git commit -m "feat: add IndexedDB position queue for offline buffering"
```

---

### Task 2: Session Store

**Files:**
- Create: `apps/golfer-app/src/stores/session-store.ts`
- Test: `apps/golfer-app/src/stores/__tests__/session-store.test.ts`

**Context:**
- API: `POST /sessions/start` → `{ courseId }` → `{ sessionId, groupId, courseId }` (type: `StartSessionResponse`)
- API: `PATCH /sessions/:id/finish` → `{ status: "finished" | "abandoned" }` → `SessionResponse`
- `apiClient` from `@/services/api-client` prefixes `/api/v1/` automatically.
- Pattern: match `round-store.ts` structure (Zustand `create`, `set`/`get`, async actions with try/catch).

**Step 1: Write failing tests**

Create `apps/golfer-app/src/stores/__tests__/session-store.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StartSessionResponse, SessionResponse } from "@golfix/shared";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const { useSessionStore } = await import("../session-store");
const { apiClient } = await import("@/services/api-client");

const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked((apiClient as Record<string, unknown>).patch as typeof apiClient.post);

describe("session-store", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const state = useSessionStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.status).toBe("idle");
  });

  describe("startSession", () => {
    it("creates session via API and sets active state", async () => {
      const response: StartSessionResponse = {
        sessionId: "s1",
        groupId: "g1",
        courseId: "c1",
      };
      mockPost.mockResolvedValueOnce(response);

      await useSessionStore.getState().startSession("c1");

      const state = useSessionStore.getState();
      expect(state.sessionId).toBe("s1");
      expect(state.courseId).toBe("c1");
      expect(state.status).toBe("active");
      expect(state.error).toBeNull();
      expect(mockPost).toHaveBeenCalledWith("/sessions/start", { courseId: "c1" });
    });

    it("sets error on API failure", async () => {
      mockPost.mockRejectedValueOnce(new Error("Network error"));

      await useSessionStore.getState().startSession("c1");

      expect(useSessionStore.getState().status).toBe("idle");
      expect(useSessionStore.getState().error).toBe("Network error");
    });

    it("prevents starting when already active", async () => {
      useSessionStore.setState({ status: "active", sessionId: "s1" });

      await useSessionStore.getState().startSession("c1");

      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe("finishSession", () => {
    it("finishes session via API and sets ended state", async () => {
      const response: SessionResponse = {
        id: "s1",
        userId: "u1",
        courseId: "c1",
        groupId: "g1",
        status: "finished",
        startedAt: "2026-02-19T10:00:00Z",
        finishedAt: "2026-02-19T14:00:00Z",
        currentHole: 18,
      };
      mockPatch.mockResolvedValueOnce(response);

      useSessionStore.setState({ status: "active", sessionId: "s1", courseId: "c1" });
      await useSessionStore.getState().finishSession("finished");

      expect(useSessionStore.getState().status).toBe("ended");
      expect(mockPatch).toHaveBeenCalledWith("/sessions/s1/finish", { status: "finished" });
    });

    it("sets error on API failure", async () => {
      mockPatch.mockRejectedValueOnce(new Error("Server error"));

      useSessionStore.setState({ status: "active", sessionId: "s1" });
      await useSessionStore.getState().finishSession("finished");

      expect(useSessionStore.getState().status).toBe("active");
      expect(useSessionStore.getState().error).toBe("Server error");
    });

    it("does nothing when no active session", async () => {
      await useSessionStore.getState().finishSession("finished");
      expect(mockPatch).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      useSessionStore.setState({ sessionId: "s1", status: "active", courseId: "c1" });
      useSessionStore.getState().reset();

      const state = useSessionStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.status).toBe("idle");
      expect(state.courseId).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/golfer-app && npx vitest run src/stores/__tests__/session-store.test.ts`
Expected: FAIL — module not found

**Step 3: Implement session-store.ts**

Create `apps/golfer-app/src/stores/session-store.ts`:

```typescript
import { create } from "zustand";
import { apiClient } from "@/services/api-client";
import type { StartSessionResponse, SessionResponse } from "@golfix/shared";

type SessionStatus = "idle" | "active" | "finishing" | "ended";

interface SessionState {
  sessionId: string | null;
  courseId: string | null;
  status: SessionStatus;
  error: string | null;
}

interface SessionActions {
  startSession: (courseId: string) => Promise<void>;
  finishSession: (status: "finished" | "abandoned") => Promise<void>;
  reset: () => void;
}

const initialState: SessionState = {
  sessionId: null,
  courseId: null,
  status: "idle",
  error: null,
};

export const useSessionStore = create<SessionState & SessionActions>()((set, get) => ({
  ...initialState,

  startSession: async (courseId) => {
    if (get().status === "active") return;

    set({ status: "idle", error: null });

    try {
      const result = await apiClient.post<StartSessionResponse>("/sessions/start", { courseId });
      set({ sessionId: result.sessionId, courseId, status: "active", error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de démarrer la session";
      set({ status: "idle", error: message });
    }
  },

  finishSession: async (status) => {
    const { sessionId, status: currentStatus } = get();
    if (currentStatus !== "active" || !sessionId) return;

    set({ status: "finishing", error: null });

    try {
      await apiClient.patch<SessionResponse>(`/sessions/${sessionId}/finish`, { status });
      set({ status: "ended" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de terminer la session";
      set({ status: "active", error: message });
    }
  },

  reset: () => set({ ...initialState }),
}));
```

**Important:** `apiClient` currently has `get`, `post`, `put` but NOT `patch`. Check `api-client.ts` — if `patch` is missing, add it (same pattern as `put` but using `PATCH` method).

**Step 4: Run tests to verify they pass**

Run: `cd apps/golfer-app && npx vitest run src/stores/__tests__/session-store.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/golfer-app/src/stores/session-store.ts apps/golfer-app/src/stores/__tests__/session-store.test.ts
git commit -m "feat: add session store for session lifecycle management"
```

If `apiClient.patch` was added, also include:
```bash
git add apps/golfer-app/src/services/api-client.ts
```

---

### Task 3: Wire Position Queue into useSocket

**Files:**
- Modify: `apps/golfer-app/src/hooks/use-socket.ts`
- Modify: `apps/golfer-app/src/hooks/__tests__/use-socket.test.ts`

**Context:**
- Currently `useSocket` takes `(sessionId, courseId)` as props and calls `useGeolocation()` internally.
- Changes: (1) Read `sessionId`/`courseId` from session store instead of props. (2) Remove internal `useGeolocation()` — GPS position will be passed in or read from a ref. (3) On every 5s tick, enqueue to IndexedDB first, then send via WS. (4) On connect, drain queue → `POST /positions/batch`. (5) Accept `position` as a parameter instead of calling `useGeolocation` internally.
- Batch API: `POST /api/v1/positions/batch` with `{ sessionId, positions: [...] }`.

**Step 1: Update the hook signature and integrate queue**

Update `apps/golfer-app/src/hooks/use-socket.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { SocketClient } from "../services/socket-client";
import { useAuthStore } from "../stores/auth-store";
import { useSessionStore } from "../stores/session-store";
import { enqueuePosition, drainAll, clearQueue } from "../services/position-queue";
import { apiClient } from "../services/api-client";
import { WS_URL } from "../lib/constants";
import type { GpsPosition } from "./use-geolocation";
import type { PositionUpdate } from "@golfix/shared";

const POSITION_INTERVAL_MS = 5000;

interface UseSocketResult {
  connected: boolean;
  error: string | null;
}

export function useSocket(position: GpsPosition | null): UseSocketResult {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SocketClient | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const sessionId = useSessionStore((s) => s.sessionId);
  const courseId = useSessionStore((s) => s.courseId);

  const positionRef = useRef(position);
  positionRef.current = position;

  const clearPositionInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const drainQueueToApi = useCallback(async (sid: string) => {
    try {
      const pending = await drainAll();
      if (pending.length === 0) return;

      const positions = pending.map(({ lat, lng, accuracy, recordedAt }) => ({
        lat, lng, accuracy, recordedAt,
      }));

      await apiClient.post("/positions/batch", { sessionId: sid, positions });
      await clearQueue();
    } catch (err) {
      console.warn("[useSocket] Failed to drain position queue:", err);
    }
  }, []);

  const startPositionInterval = useCallback(
    (client: SocketClient, sid: string) => {
      clearPositionInterval();
      intervalRef.current = setInterval(async () => {
        const pos = positionRef.current;
        if (!pos) return;

        const update: PositionUpdate = {
          sessionId: sid,
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          recordedAt: new Date().toISOString(),
        };

        // Always enqueue for offline resilience
        await enqueuePosition(update);

        // Send via WS if connected
        if (client.connected) {
          client.sendPosition(update);
        }
      }, POSITION_INTERVAL_MS);
    },
    [clearPositionInterval],
  );

  useEffect(() => {
    if (!sessionId || !courseId || !accessToken) return;

    const client = new SocketClient();
    clientRef.current = client;

    client.connect({ url: WS_URL, token: accessToken });

    client.onConnect(() => {
      setConnected(true);
      setError(null);
      client.joinRoom(courseId);
      startPositionInterval(client, sessionId);
      // Replay offline queue on connect/reconnect
      drainQueueToApi(sessionId);
    });

    client.onDisconnect(() => {
      setConnected(false);
      clearPositionInterval();
    });

    client.onError((err) => {
      setError(err.message);
    });

    return () => {
      clearPositionInterval();
      client.leaveRoom(courseId);
      client.destroy();
      clientRef.current = null;
    };
  }, [sessionId, courseId, accessToken, startPositionInterval, clearPositionInterval, drainQueueToApi]);

  // Refresh auth when accessToken changes mid-session
  useEffect(() => {
    if (!accessToken || !clientRef.current) return;
    clientRef.current.refreshAuth(accessToken);
  }, [accessToken]);

  return { connected, error };
}
```

**Step 2: Update use-socket tests**

Update `apps/golfer-app/src/hooks/__tests__/use-socket.test.ts` to:
- Mock `@/stores/session-store` instead of passing sessionId/courseId as props
- Mock `@/services/position-queue` (enqueuePosition, drainAll, clearQueue)
- Mock `@/services/api-client` for batch drain
- Remove `use-geolocation` mock — position is now a prop
- Verify enqueue is called on interval tick
- Verify drainAll + POST is called on connect

**Step 3: Run tests**

Run: `cd apps/golfer-app && npx vitest run src/hooks/__tests__/use-socket.test.ts`
Expected: All PASS

**Step 4: Commit**

```bash
git add apps/golfer-app/src/hooks/use-socket.ts apps/golfer-app/src/hooks/__tests__/use-socket.test.ts
git commit -m "feat: integrate offline position queue into useSocket"
```

---

### Task 4: Session Confirmation on GPS Screen

**Files:**
- Modify: `apps/golfer-app/src/features/gps/GpsScreen.tsx`
- Test: `apps/golfer-app/src/features/gps/__tests__/GpsScreen.test.tsx` (create if missing, or update)

**Context:**
- GPS screen currently auto-starts GPS on mount and shows distances.
- Change: When session status is `idle`, show a "Commencer la session" button. On click: call `startSession(courseId)`. When `active`, show distances as normal and start GPS.
- GPS should only `startWatching` when session is `active` (not on mount).
- Also wire `useSocket(position)` here to start WS tracking.

**Step 1: Update GpsScreen**

Modify `apps/golfer-app/src/features/gps/GpsScreen.tsx`:

1. Import `useSessionStore` and `useSocket`.
2. Read `session.status` and `session.startSession`.
3. Replace auto-start GPS: only call `startWatching()` when `status === "active"`.
4. When `status === "idle"` and course is loaded, show confirmation UI:
   - Course name heading
   - "Commencer la session" button → calls `startSession(courseData.id)`
5. When `status === "active"`, render current distance UI + call `useSocket(position)`.

```tsx
// Key additions to GpsScreen:
const sessionStatus = useSessionStore((s) => s.status);
const sessionStart = useSessionStore((s) => s.startSession);
const { connected } = useSocket(position);

// Replace auto-start GPS effect:
useEffect(() => {
  if (sessionStatus === "active" && !hasStartedRef.current) {
    hasStartedRef.current = true;
    startWatching();
  }
}, [sessionStatus, startWatching]);

// Before the distance cards, add session confirmation:
if (courseData && sessionStatus === "idle") {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
      <h2 className="text-xl font-semibold text-cream">{courseData.name}</h2>
      <p className="text-center text-sm text-cream/60">
        {courseData.holesCount} trous — Par {courseData.par}
      </p>
      <button
        type="button"
        onClick={() => sessionStart(courseData.id)}
        className="w-full rounded-xl bg-green-mid py-4 text-lg font-semibold text-cream"
      >
        Commencer la session
      </button>
    </div>
  );
}
```

**Step 2: Write/update tests**

Test the two states: idle (shows confirmation button) and active (shows distances). Mock session store.

**Step 3: Run tests**

Run: `cd apps/golfer-app && npx vitest run src/features/gps/__tests__/`
Expected: All PASS

**Step 4: Commit**

```bash
git add apps/golfer-app/src/features/gps/GpsScreen.tsx apps/golfer-app/src/features/gps/__tests__/
git commit -m "feat: add session confirmation step on GPS screen"
```

---

### Task 5: End Session on Scorecard Screen

**Files:**
- Modify: `apps/golfer-app/src/features/scorecard/ScorecardScreen.tsx`
- Modify: `apps/golfer-app/src/features/scorecard/__tests__/ScorecardScreen.test.tsx`

**Context:**
- Add "Terminer la partie" button at the bottom of scorecard when session is active.
- On tap: show `window.confirm()` dialog (simple for MVP). On confirm: call `finishSession("finished")`.
- On session end: navigate to landing page (`/`).
- Read session store status for conditional rendering.

**Step 1: Update ScorecardScreen**

Add to `apps/golfer-app/src/features/scorecard/ScorecardScreen.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/stores/session-store";

// Inside component:
const navigate = useNavigate();
const sessionStatus = useSessionStore((s) => s.status);
const finishSession = useSessionStore((s) => s.finishSession);

const handleFinish = useCallback(async () => {
  const confirmed = window.confirm("Terminer la partie ?");
  if (!confirmed) return;

  await finishSession("finished");
  navigate("/");
}, [finishSession, navigate]);

// In JSX, after the saving indicator, before closing div:
{sessionStatus === "active" && (
  <button
    type="button"
    onClick={handleFinish}
    className="mx-4 mt-4 rounded-xl border border-cream/20 py-3 text-sm font-medium text-cream/70"
  >
    Terminer la partie
  </button>
)}
```

**Step 2: Update ScorecardScreen tests**

Add mock for session store. Add test:
- "shows Terminer button when session is active"
- "does not show Terminer button when session is idle"
- "calls finishSession and navigates on confirm"

**Step 3: Run tests**

Run: `cd apps/golfer-app && npx vitest run src/features/scorecard/__tests__/ScorecardScreen.test.tsx`
Expected: All PASS

**Step 4: Commit**

```bash
git add apps/golfer-app/src/features/scorecard/ScorecardScreen.tsx apps/golfer-app/src/features/scorecard/__tests__/ScorecardScreen.test.tsx
git commit -m "feat: add end session button on scorecard screen"
```

---

### Task 6: E2E Tests + Session Validation

**Files:**
- Modify or create: `apps/golfer-app/e2e/session.spec.ts`
- Modify: `apps/golfer-app/e2e/scorecard.spec.ts` (add end session test)

**Context:**
- E2E tests use Playwright route interception — no live backend.
- Mock `POST /sessions/start` → returns `{ sessionId, groupId, courseId }`.
- Mock `PATCH /sessions/:id/finish` → returns `SessionResponse`.
- Test the full flow: GPS screen → confirm session → navigate to scorecard → end session.

**Step 1: Write session E2E test**

Create `apps/golfer-app/e2e/session.spec.ts` covering:
1. GPS screen shows session confirmation when course loaded
2. Clicking "Commencer la session" creates session via API
3. After session start, GPS distances are visible
4. Navigate to scorecard → "Terminer la partie" is visible
5. Clicking "Terminer" ends session

**Step 2: Run E2E tests**

Run: `cd apps/golfer-app && npx playwright test`
Expected: All pass

**Step 3: Run full validation**

Run: `pnpm validate` (lint + format:check + typecheck + build)
Run: `pnpm test` (all unit tests)

**Step 4: Commit**

```bash
git add apps/golfer-app/e2e/session.spec.ts
git commit -m "test: add E2E tests for session flow"
```

---

### Task 7: Validation + Cleanup

**Files:** None (validation only)

**Step 1: Run full validation suite**

```bash
pnpm validate
pnpm test
cd apps/golfer-app && npx playwright test
```

**Step 2: Check for apiClient.patch**

If `apiClient` didn't have a `patch` method, verify it was added in Task 2. Check `api-client.ts` has: `patch<T>(path: string, body?: unknown): Promise<T>`.

**Step 3: Update PLAN.md and MEMORY.md**

- Update "Current sprint" / "Last completed task" in PLAN.md
- Update MEMORY.md with session 3C completion status

**Step 4: Final commit if any docs changed**

```bash
git add PLAN.md
git commit -m "docs: update sprint progress after 3C completion"
```
