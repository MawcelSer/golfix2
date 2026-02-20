# Sprint 5 — Dashboard & Notifications

**Branch:** `feat/sprint-5a-dashboard-foundation`
**Status:** Complete
**Date:** 2026-02-20

## Summary

Built the manager dashboard — a real-time course monitoring tool that consumes pace engine output and lets managers act on it. Wired the pace engine to Socket.io for live WebSocket events, and created the daily report API.

## Sessions

### 5A — Dashboard Foundation + Pace Engine Wiring (5 tasks)

1. **5A.1: Scaffold dashboard app** — React 19 + Vite 6 + Tailwind v4, Zustand auth store (persisted), api-client with JWT refresh, LoginScreen (email/password only), RoleGuard (checks managed courses), DashboardShell (sidebar + main), router
2. **5A.2: Course list API endpoint** — `GET /api/v1/courses/managed` returns courses where user has a courseRole
3. **5A.3: Dashboard shared types + stores** — Added `GROUPS_UPDATE`, `ALERT_NEW`, `BOTTLENECK_UPDATE` socket events and interfaces to shared package. Dashboard store (Zustand, non-persisted), socket client class, `useDashboardSocket` hook
4. **5A.4: Pace engine plugin** — `PaceEngineManager` (lazy per-course engines), `paceEnginePlugin` (5s setInterval tick → serialize → emit to dashboard room). Modified position handler to feed pace engine
5. **5A.5: Course selector page** — `CourseListScreen` with cards, click navigates to dashboard

### 5B — Dashboard UI: Map, Groups, Alerts (4 tasks)

1. **5B.1: Live course map** — Mapbox GL JS (satellite-streets), group markers colored by pace status, hole pins at green centers. Graceful fallback when no token
2. **5B.2: Group list panel** — Sortable table (group #, hole, status, pace factor, players, projected finish). Custom pace-status sort order
3. **5B.3: Alert feed panel** — Chronological alert list with severity filters (Tout/Critique/Attention/Info), French formatting
4. **5B.4: Dashboard page composition** — Map (60%) + side panels (40%) layout, course data fetch via `GET /courses/by-id/:courseId/data`, WebSocket connection, connection status indicator

### 5C — Reminders + Daily Report (4 tasks)

1. **5C.1: Send reminder API** — `POST /courses/:courseId/reminders/:groupId` (owner/admin/marshal), validates group, counts recipients with pace_reminders enabled, inserts pace_event
2. **5C.2: Send reminder UI** — SendReminderDialog (modal + optional message), toast notification system, "Rappel" button on group rows with attention/behind status
3. **5C.3: Daily report API** — `GET /courses/:courseId/reports/daily/:date` (all manager roles + viewer), aggregates rounds/sessions/pace events for date range
4. **5C.4: Daily report view** — DailyReportScreen with date picker, stat cards, sessions breakdown, pace events by type and severity

### 5D — Polish + E2E (3 tasks)

1. **5D.1: Dashboard Playwright E2E** — 8 tests: auth flow (login form, login redirect, unauthenticated redirect), course list (shows courses, details, navigation), dashboard (panels loaded, connection status)
2. **5D.2: Pipeline integration test** — 6 tests: PaceEngineManager creation, position feeding, full pipeline (groups → positions → tick → serialize → emit), JSON serializability, multi-course independence
3. **5D.3: Build config + validation** — Vitest E2E exclusion, full validation suite green

## Test Counts

| Workspace | Unit Tests | E2E Tests |
|-----------|-----------|-----------|
| dashboard | 74 | 8 |
| golfer-app | 222 | 30 |
| api (non-DB) | 103 | — |
| shared | 4 | — |
| tools | 47 | — |

## Key Files Created

### API
- `apps/api/src/pace/pace-engine-manager.ts` — Per-course engine lifecycle
- `apps/api/src/pace/pace-engine-plugin.ts` — Fastify plugin, 5s tick, Socket.io emission
- `apps/api/src/pace/reminder-schemas.ts` + `reminder-service.ts` + `reminder-routes.ts`
- `apps/api/src/reports/report-schemas.ts` + `report-service.ts` + `report-routes.ts`

### Dashboard (~25 files)
- `apps/dashboard/src/services/api-client.ts` — Fetch wrapper with JWT refresh
- `apps/dashboard/src/stores/auth-store.ts` — Zustand persist (localStorage)
- `apps/dashboard/src/stores/dashboard-store.ts` — Live state (groups, alerts, bottlenecks)
- `apps/dashboard/src/services/socket-client.ts` — DashboardSocketClient class
- `apps/dashboard/src/hooks/use-dashboard-socket.ts` — React hook for dashboard room
- `apps/dashboard/src/features/auth/` — LoginScreen, AuthGuard, RoleGuard
- `apps/dashboard/src/features/courses/CourseListScreen.tsx`
- `apps/dashboard/src/features/dashboard/DashboardPage.tsx`
- `apps/dashboard/src/features/map/` — CourseMap, GroupMarkers, HolePins
- `apps/dashboard/src/features/groups/` — GroupListPanel, GroupRow, PaceStatusBadge, SendReminderDialog
- `apps/dashboard/src/features/alerts/` — AlertFeedPanel, AlertCard, format-alert
- `apps/dashboard/src/features/reports/DailyReportScreen.tsx`
- `apps/dashboard/src/components/` — DashboardShell, Toast

### Shared Package
- `packages/shared/src/types/socket.ts` — Dashboard event types (DashboardGroupUpdate, DashboardAlertEvent, DashboardBottleneckEvent)

## Key Files Modified
- `apps/api/src/app.ts` — Registered reminder and report routes
- `apps/api/src/ws/position-handler.ts` — Feeds PaceEngineManager
- `apps/api/src/courses/course-service.ts` — Added `getCourseDataById`
- `apps/api/src/courses/course-routes.ts` — Added `/by-id/:courseId/data` route

## Decisions & Gotchas

- **Skipped shared UI extraction** — Copy patterns from golfer-app, different enough that extraction is premature
- **Deferred FCM/Web Push** — Reminder works as REST-only for MVP
- **Mapbox fallback** — Shows "Carte indisponible" message when token missing (safe for E2E)
- **JSDOM hex→rgb** — Test colors via data attributes, not exact hex comparison
- **Vitest picks up Playwright files** — Must add `exclude: ["e2e/**"]` to vitest config
- **SessionInfo type** — Requires `{ sessionId, startedAt: Date, position }`, not `{ sessionId, lat, lng }`
- **TeeTimeInfo type** — Uses `scheduledAt` and `playersCount` (not `teeTime`/`playerCount`)
- **Dashboard auth localStorage** — Key is `"golfix-dashboard-auth"`, Zustand persist format `{ state: {...}, version: 0 }`
