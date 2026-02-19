# Sprint 3C Design — Offline Queue, Background GPS, Session Flow

**Date:** 2026-02-19
**Tasks:** 3.10, 3.11, 3.12
**Branch:** `feat/sprint-3c-scorecard`

## 3.10 — Offline Position Queue

IndexedDB-backed queue that buffers GPS positions when WebSocket is disconnected, replays via REST on reconnect.

### Architecture

- **`services/position-queue.ts`** — wrapper around `idb-keyval` with a dedicated store (`position-queue`), separate from course cache.
- **Methods:** `enqueue(position)`, `drainAll()`, `size()`, `clear()`
- **Max entries:** 2000 (FIFO eviction when full) — covers ~2.7 hours at 5s interval.
- **Entry shape:** `PositionUpdate` payload (sessionId, lat, lng, accuracy, recordedAt).

### Integration with useSocket

- Every 5s tick: enqueue to IndexedDB first, then send via WS if connected.
- On WS `connect` event: drain queue → `POST /api/v1/positions/batch` → clear on success.
- On drain failure: positions stay in queue for next reconnect.

### Scope

GPS positions only. Scores are already retained locally in the round store (`synced: false` flag) and re-sent on next `saveScore` call.

## 3.11 — Background GPS

### Current State

`useGeolocation` already implements `watchPosition` with `enableHighAccuracy: true`, `maximumAge: 5000`, `timeout: 10000`. Stops on error, manual retry available.

### Changes

- Lift GPS lifecycle to session flow: start watching when session starts, stop when session ends.
- Remove unconditional `useGeolocation()` call from `useSocket` (code review finding).
- GPS start/stop controlled by session store status.

### Platform Limitations (documented)

- **Android:** GPS works in background — no code change needed.
- **iOS:** PWA GPS only works in foreground. Acceptable for MVP.

## 3.12 — Session Flow

### Session Store (`stores/session-store.ts`)

Zustand store:

```typescript
interface SessionState {
  sessionId: string | null;
  courseId: string | null;
  status: 'idle' | 'confirming' | 'active' | 'finishing' | 'ended';
  error: string | null;
}
```

Actions: `startSession(courseId)`, `finishSession(status)`, `reset()`

### UX Flow

1. **Landing page** — "Démarrer un parcours" → GDPR check → locate course → navigate to `/gps?course=slug`
2. **GPS screen** — Shows course name + "Commencer la session" confirmation button (when `status === 'idle'`). On confirm: `POST /api/v1/sessions/start` → sets `status: 'active'` → starts WS + GPS. Button disappears, GPS distances shown.
3. **During active session** — GPS distances live, scorecard works, positions queued/sent.
4. **Scorecard screen** — "Terminer la partie" button visible when session is active. On tap: confirmation dialog → `PATCH /api/v1/sessions/:id/finish` → stops WS + GPS → `status: 'ended'` → navigates to landing.

### Key Decisions

- GPS screen doubles as session confirmation screen — no new route.
- Session store is separate from round store (session = tracking/WS, round = scoring).
- `useSocket` reads sessionId from session store instead of taking it as a prop.
- Two-step flow allows future tee selection on the confirmation step.
- "Terminer" lives on the scorecard screen (natural place to end a round).
- Summary screen is deferred to task 3.13.

## API Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/sessions/start` | Create session |
| PATCH | `/api/v1/sessions/:id/finish` | End session |
| GET | `/api/v1/sessions/:id` | Get session details |
| POST | `/api/v1/positions/batch` | Replay offline queue |

## Files to Create/Modify

### New files
- `services/position-queue.ts` — IndexedDB position queue
- `services/__tests__/position-queue.test.ts`
- `stores/session-store.ts` — Session state management
- `stores/__tests__/session-store.test.ts`

### Modified files
- `hooks/use-socket.ts` — integrate offline queue, read from session store
- `hooks/__tests__/use-socket.test.ts`
- `features/gps/GpsScreen.tsx` — add session confirmation button
- `features/scorecard/ScorecardScreen.tsx` — add "Terminer" button
- `hooks/use-geolocation.ts` — no changes needed (already complete)
