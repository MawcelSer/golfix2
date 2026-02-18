# Sprint 2 — API, Auth & Real-time Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete backend with JWT authentication, course/session/scoring CRUD, PostGIS spatial queries, WebSocket position ingestion with buffering, and GPX import tool.

**Architecture:** Feature-based directory layout under `apps/api/src/`. Each feature (auth, courses, sessions, etc.) gets its own directory with routes, service, and schemas. A shared middleware layer handles JWT verification and role guards. Socket.io runs alongside Fastify for real-time position ingestion. PositionBuffer batches GPS writes to PostgreSQL every 2s.

**Tech Stack:** Fastify 5, Drizzle ORM, PostgreSQL 16 + PostGIS 3.4, Socket.io 4, bcrypt, jsonwebtoken, Zod, Vitest

---

## Dependency Graph

```
Task 0 (deps + scaffolding)
  ├── Task 1 (auth service + routes)
  │     ├── Task 2 (auth middleware)
  │     │     ├── Task 3 (course endpoints)
  │     │     ├── Task 4 (session endpoints)
  │     │     ├── Task 5 (scoring endpoints)
  │     │     └── Task 8 (position batch endpoint)
  │     └── Task 7 (Socket.io + position ingestion)
  ├── Task 6 (spatial query service) ── used by Task 3, 7
  ├── Task 9 (PositionBuffer) ── used by Task 7, 8
  └── Task 10 (GPX import)
Task 11 (integration tests) ── after all above
Task 12 (wire simulation plugin to PositionBuffer)
```

## Reference Files

| File | Purpose |
|------|---------|
| `apps/api/src/app.ts` | Fastify app builder — register new route plugins here |
| `apps/api/src/db/connection.ts` | `db` export — import this in services |
| `apps/api/src/db/schema/` | All 13 tables + 6 enums |
| `apps/api/src/db/seed.ts` | Seed data — users, course, holes, tee times |
| `.env.example` | Environment variables (JWT_SECRET, DATABASE_URL, etc.) |
| `PLAN.md:557-652` | Key Technical Notes (spatial queries, rate limits, WS token refresh) |

## Codebase Conventions

- **API prefix:** All routes under `/api/v1/`
- **Zod validation:** All request bodies validated with Zod schemas
- **Error responses:** `{ error: string, statusCode: number }`
- **Test pattern:** `app.inject()` for HTTP tests (see `app.test.ts`)
- **DB connection:** Import `db` from `../db/connection` (singleton)
- **Immutable patterns:** Return new objects, don't mutate
- **Functions:** Under 50 lines, single responsibility
- **Files:** 200-400 lines typical, 800 max

---

### Task 0: Install Dependencies + Scaffold Directories

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/app.ts`
- Create: directory structure

**Step 1: Install new dependencies**

```bash
cd apps/api
pnpm add bcrypt jsonwebtoken socket.io @fastify/jwt @fastify/cookie
pnpm add -D @types/bcrypt @types/jsonwebtoken
```

**Step 2: Create feature directories**

```bash
mkdir -p apps/api/src/auth
mkdir -p apps/api/src/courses
mkdir -p apps/api/src/sessions
mkdir -p apps/api/src/scoring
mkdir -p apps/api/src/positions
mkdir -p apps/api/src/spatial
mkdir -p apps/api/src/ws
mkdir -p apps/api/src/middleware
```

**Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore: add Sprint 2 dependencies — bcrypt, jsonwebtoken, socket.io"
```

---

### Task 1: Auth Service + Routes (register, login, anonymous)

**Files:**
- Create: `apps/api/src/auth/auth-schemas.ts` — Zod request/response schemas
- Create: `apps/api/src/auth/auth-service.ts` — Business logic (hash, verify, JWT)
- Create: `apps/api/src/auth/auth-routes.ts` — Fastify route plugin
- Create: `apps/api/src/auth/__tests__/auth-routes.test.ts`

**Step 1: Write auth schemas**

`apps/api/src/auth/auth-schemas.ts`:

```typescript
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const anonymousSchema = z.object({
  displayName: z.string().min(1).max(100),
  deviceId: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/, "Invalid device_id format"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AnonymousInput = z.infer<typeof anonymousSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
```

**Step 2: Write auth service**

`apps/api/src/auth/auth-service.ts`:

Core functions:
- `hashPassword(plain)` → bcrypt hash (cost 12)
- `verifyPassword(plain, hash)` → boolean
- `generateTokenPair(userId)` → `{ accessToken, refreshToken }`
- `verifyAccessToken(token)` → payload or throws
- `storeRefreshToken(userId, token)` → inserts hashed token into DB
- `verifyRefreshToken(token)` → validates, checks `revoked_at`, returns userId
- `revokeRefreshToken(tokenHash)` → sets `revoked_at`
- `registerUser(input: RegisterInput)` → creates user, returns token pair
- `registerAnonymous(input: AnonymousInput)` → creates user with deviceId, returns token pair
- `loginUser(input: LoginInput)` → verifies credentials, returns token pair

JWT payload: `{ sub: userId, iat, exp }`
Access token: 15 min expiry
Refresh token: 7 days expiry, stored as SHA-256 hash in `refresh_tokens` table

**Step 3: Write auth routes**

`apps/api/src/auth/auth-routes.ts`:

```typescript
// POST /auth/register     — registerSchema → registerUser()
// POST /auth/login        — loginSchema → loginUser()
// POST /auth/anonymous    — anonymousSchema → registerAnonymous()
// POST /auth/refresh      — refreshSchema → verifyRefreshToken() → new pair
// POST /auth/logout       — refreshSchema → revokeRefreshToken()
```

Rate limit auth routes to 10 req/min per IP. Anonymous register: 5 req/hour per IP.

**Step 4: Write tests**

`apps/api/src/auth/__tests__/auth-routes.test.ts`:

Tests (using `app.inject()`):
1. POST `/auth/register` — creates user, returns tokens
2. POST `/auth/register` — duplicate email returns 409
3. POST `/auth/register` — invalid email returns 400
4. POST `/auth/login` — valid credentials return tokens
5. POST `/auth/login` — wrong password returns 401
6. POST `/auth/login` — unknown email returns 401
7. POST `/auth/anonymous` — creates user with deviceId
8. POST `/auth/anonymous` — invalid deviceId format returns 400
9. POST `/auth/refresh` — valid token returns new pair
10. POST `/auth/refresh` — revoked token returns 401
11. POST `/auth/logout` — revokes refresh token

**Important:** Tests need a real DB (PostGIS). Use `beforeAll` to build app, `afterAll` to close. Clean up test users between tests (delete from `users` where email like `%@test.golfix%`).

**Step 5: Register routes in app.ts**

```typescript
// In buildApp(), inside the /api/v1 prefix registration:
import { authRoutes } from "./auth/auth-routes";
api.register(authRoutes, { prefix: "/auth" });
```

**Step 6: Run tests, verify pass**

```bash
pnpm --filter @golfix/api test
```

**Step 7: Commit**

```bash
git commit -m "feat(auth): register, login, anonymous, refresh, logout endpoints"
```

---

### Task 2: Auth Middleware (verifyToken + requireRole)

**Files:**
- Create: `apps/api/src/middleware/auth-middleware.ts`
- Create: `apps/api/src/middleware/__tests__/auth-middleware.test.ts`

**Step 1: Write middleware**

`apps/api/src/middleware/auth-middleware.ts`:

```typescript
// verifyToken — Fastify preHandler hook
//   - Reads Authorization: Bearer <token> header
//   - Verifies JWT, sets request.userId
//   - Returns 401 if missing/invalid

// requireRole(courseIdParam, ...roles) — Fastify preHandler hook
//   - Requires verifyToken to have run first
//   - Looks up course_roles for (request.userId, courseId)
//   - Returns 403 if user doesn't have required role
```

Augment Fastify's `FastifyRequest` type:
```typescript
declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}
```

**Step 2: Write tests**

Tests:
1. Request without token → 401
2. Request with invalid token → 401
3. Request with expired token → 401
4. Request with valid token → userId set, passes through
5. requireRole with matching role → passes
6. requireRole with wrong role → 403
7. requireRole with no role → 403

**Step 3: Run tests, commit**

```bash
git commit -m "feat(auth): verifyToken and requireRole middleware"
```

---

### Task 3: Course Endpoints

**Files:**
- Create: `apps/api/src/courses/course-schemas.ts`
- Create: `apps/api/src/courses/course-service.ts`
- Create: `apps/api/src/courses/course-routes.ts`
- Create: `apps/api/src/courses/__tests__/course-routes.test.ts`

**Step 1: Write schemas**

```typescript
export const locateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Response: { courseId, name, slug } or 404
```

**Step 2: Write service**

`course-service.ts`:
- `locateCourse(lat, lng)` — `SELECT id, name, slug FROM courses WHERE ST_Within(ST_SetSRID(ST_MakePoint($lng, $lat), 4326), boundary)` via Drizzle `sql` template
- `getCourseData(slug)` — Returns full course with holes, hazards, `data_version`. Joins holes + hazards. This is the big geodata payload cached client-side.

**Step 3: Write routes**

```typescript
// POST /courses/locate       — locateSchema → locateCourse()
// GET  /courses/:slug/data   — getCourseData() (public, no auth required)
```

`/courses/locate` rate-limited to 30 req/min per IP.

**Step 4: Write tests**

Tests (need seeded DB):
1. POST `/courses/locate` with point inside seed course → returns course
2. POST `/courses/locate` with point outside → 404
3. GET `/courses/bordeaux-lac-test/data` → returns 18 holes with positions
4. GET `/courses/unknown-slug/data` → 404

**Step 5: Register in app.ts, run tests, commit**

```bash
git commit -m "feat(courses): locate and geodata endpoints"
```

---

### Task 4: Session Endpoints

**Files:**
- Create: `apps/api/src/sessions/session-schemas.ts`
- Create: `apps/api/src/sessions/session-service.ts`
- Create: `apps/api/src/sessions/session-routes.ts`
- Create: `apps/api/src/sessions/__tests__/session-routes.test.ts`

**Step 1: Write schemas + service**

```typescript
export const startSessionSchema = z.object({
  courseId: z.string().uuid(),
});

export const finishSessionSchema = z.object({
  status: z.enum(["finished", "abandoned"]),
});
```

Service:
- `startSession(userId, courseId)` → Creates session + auto-assigns to group (or creates new group). Returns `{ sessionId, groupId }`.
- `finishSession(sessionId, userId, status)` → Sets `finishedAt`, updates status. Validates ownership.

Group assignment: Find existing group for today on this course with < 4 players, or create a new one.

**Step 2: Write routes (auth required)**

```typescript
// POST  /sessions/start       — verifyToken → startSession()
// PATCH /sessions/:id/finish  — verifyToken → finishSession()
// GET   /sessions/:id         — verifyToken → getSession()
```

**Step 3: Write tests, register in app.ts, commit**

```bash
git commit -m "feat(sessions): start and finish session endpoints"
```

---

### Task 5: Scoring Endpoints

**Files:**
- Create: `apps/api/src/scoring/scoring-schemas.ts`
- Create: `apps/api/src/scoring/scoring-service.ts`
- Create: `apps/api/src/scoring/scoring-routes.ts`
- Create: `apps/api/src/scoring/__tests__/scoring-routes.test.ts`

**Step 1: Write schemas + service**

```typescript
export const createRoundSchema = z.object({
  courseId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
});

export const upsertScoreSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  strokes: z.number().int().min(1).max(20),
  putts: z.number().int().min(0).max(10).optional(),
  fairwayHit: z.boolean().optional(),
  greenInRegulation: z.boolean().optional(),
});
```

Service:
- `createRound(userId, courseId, sessionId?)` → insert into `rounds`
- `upsertScore(roundId, userId, score)` → upsert into `scores` (unique on roundId+holeNumber)
- `getUserRounds(userId)` → list with totals
- `getRoundDetail(roundId, userId)` → round + all scores

**Step 2: Write routes (auth required)**

```typescript
// POST /rounds                    — createRound()
// PUT  /rounds/:id/scores         — upsertScore() (accepts single score)
// GET  /users/me/rounds           — getUserRounds()
// GET  /rounds/:id                — getRoundDetail()
```

**Step 3: Write tests, register in app.ts, commit**

```bash
git commit -m "feat(scoring): rounds and per-hole score endpoints"
```

---

### Task 6: Spatial Query Service

**Files:**
- Create: `apps/api/src/spatial/spatial-service.ts`
- Create: `apps/api/src/spatial/__tests__/spatial-service.test.ts`

**Step 1: Write service**

`spatial-service.ts` — Reusable functions wrapping PostGIS queries via Drizzle's `sql` template:

```typescript
// isOnCourse(lat, lng) → courseId | null
//   SELECT id FROM courses WHERE ST_Within(ST_SetSRID(ST_MakePoint($lng,$lat), 4326), boundary)

// detectHole(courseId, lat, lng) → holeNumber | null
//   SELECT hole_number FROM holes WHERE course_id = $1
//   AND ST_Within(ST_SetSRID(ST_MakePoint($lng,$lat), 4326), geofence)

// distanceToGreen(holeId, lat, lng) → { front: number, center: number, back: number }
//   SELECT ST_Distance(point::geography, green_center::geography), ...
```

**Step 2: Write tests (require seeded DB)**

Tests:
1. `isOnCourse` — point inside seed course → returns courseId
2. `isOnCourse` — point in ocean → returns null
3. `detectHole` — point at hole 1 tee → returns 1
4. `distanceToGreen` — returns reasonable meter values

**Step 3: Commit**

```bash
git commit -m "feat(spatial): PostGIS query service — isOnCourse, detectHole, distanceToGreen"
```

---

### Task 7: Socket.io Server + Position Ingestion

**Files:**
- Create: `apps/api/src/ws/socket-server.ts` — Socket.io initialization
- Create: `apps/api/src/ws/position-handler.ts` — `position:update` event handler
- Create: `apps/api/src/ws/__tests__/position-handler.test.ts`
- Modify: `apps/api/src/app.ts` — attach Socket.io to Fastify

**Step 1: Write socket server setup**

`ws/socket-server.ts`:
- Create Socket.io server attached to Fastify's underlying HTTP server
- JWT auth middleware on connection (`socket.handshake.auth.token`)
- Room management: `room:join` / `room:leave` events
- Handle `auth:refresh` event (update socket auth context)

**Step 2: Write position handler**

`ws/position-handler.ts`:

```typescript
const positionUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  recordedAt: z.string().datetime(),
});
```

On `position:update`:
1. Validate with Zod
2. Verify session belongs to this user
3. Add to PositionBuffer
4. Optionally detect hole via spatial service
5. Emit to `course:${id}:dashboard` room (aggregated)

**Step 3: Modify app.ts**

```typescript
// After app is created, before return:
import { setupSocketServer } from "./ws/socket-server";
const io = setupSocketServer(app);
```

**Step 4: Write tests, commit**

```bash
git commit -m "feat(ws): Socket.io server with JWT auth and position ingestion"
```

---

### Task 8: Position Batch Endpoint

**Files:**
- Create: `apps/api/src/positions/position-schemas.ts`
- Create: `apps/api/src/positions/position-service.ts`
- Create: `apps/api/src/positions/position-routes.ts`
- Create: `apps/api/src/positions/__tests__/position-routes.test.ts`

**Step 1: Write schemas + service**

```typescript
export const positionBatchSchema = z.object({
  sessionId: z.string().uuid(),
  positions: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().positive(),
    recordedAt: z.string().datetime(),
  })).min(1).max(2000),
});
```

Service:
- `batchInsertPositions(sessionId, userId, positions[])` — Verify session ownership, deduplicate by `(session_id, recorded_at)`, bulk INSERT.

**Step 2: Write route (auth required)**

```typescript
// POST /positions/batch — verifyToken → batchInsertPositions()
```

**Step 3: Write tests, register, commit**

```bash
git commit -m "feat(positions): batch position endpoint for offline replay"
```

---

### Task 9: PositionBuffer — In-Memory

**Files:**
- Create: `apps/api/src/positions/position-buffer.ts`
- Create: `apps/api/src/positions/__tests__/position-buffer.test.ts`

**Step 1: Write PositionBuffer interface + InMemoryPositionBuffer**

```typescript
export interface PositionInput {
  sessionId: string;
  lat: number;
  lng: number;
  accuracy: number;
  recordedAt: Date;
}

export interface PositionBuffer {
  add(position: PositionInput): void;
  flush(): Promise<number>;
  size(): number;
  start(): void;   // starts 2s flush interval
  stop(): void;     // stops interval, final flush
}

export class InMemoryPositionBuffer implements PositionBuffer {
  // Map<string, PositionInput[]> keyed by sessionId
  // flush() → bulk INSERT via Drizzle, clear buffer
  // Interval: setInterval(flush, 2000)
}
```

**Step 2: Write tests**

Tests:
1. `add()` increases `size()`
2. `flush()` inserts rows into DB and returns count
3. `flush()` clears buffer after insert
4. Empty `flush()` returns 0 without DB call
5. Multiple sessions buffered independently

**Step 3: Commit**

```bash
git commit -m "feat(positions): InMemoryPositionBuffer with 2s flush interval"
```

---

### Task 10: GPX Import CLI

**Files:**
- Modify: `tools/import-course/package.json` — add dependencies
- Create: `tools/import-course/src/index.ts` — CLI entry
- Create: `tools/import-course/src/gpx-parser.ts` — GPX XML parsing
- Create: `tools/import-course/src/geofence-generator.ts` — convex hull + buffer
- Create: `tools/import-course/src/__tests__/gpx-parser.test.ts`

**Step 1: Add dependencies**

```bash
cd tools/import-course
pnpm add commander fast-xml-parser zod drizzle-orm postgres
pnpm add -D @types/node tsx vitest
```

**Step 2: Implement GPX parser**

Naming convention for waypoints:
- `Tee_01` through `Tee_18` — tee positions
- `Green_01` through `Green_18` — green centers
- `Hazard_01_bunker` — hazard with type

Parse GPX `<wpt>` elements, extract lat/lon/name, validate against naming convention.

**Step 3: Implement geofence generator**

For each hole: compute bounding box around tee→green line, buffer by `max(distance*0.6, 100)m`. Generate EWKT polygon.

**Step 4: Write CLI**

```bash
pnpm --filter @golfix/import-course start -- --gpx course.gpx --name "Mon Golf" --slug mon-golf
```

**Step 5: Write tests, commit**

```bash
git commit -m "feat(tools): GPX import CLI — parse waypoints, generate geofences, insert course"
```

---

### Task 11: Integration Tests

**Files:**
- Create: `apps/api/src/__tests__/integration/auth.integration.test.ts`
- Create: `apps/api/src/__tests__/integration/spatial.integration.test.ts`
- Create: `apps/api/src/__tests__/integration/session-flow.integration.test.ts`

**Step 1: Write auth integration tests**

Full flow tests (require running PostgreSQL with seed data):
1. Register → login → access protected route → success
2. Register → get tokens → refresh → new tokens work
3. Register → logout → refresh with old token → 401
4. Anonymous register → access protected route → success
5. Rate limiting: 11 auth requests in 1 min → 429

**Step 2: Write spatial integration tests**

1. Course locate with seed course coordinates → found
2. Hole detection at each of the 18 tee positions → correct hole number
3. Distance to green from tee → reasonable value (within ±50m of `distanceMeters`)

**Step 3: Write session flow integration tests**

1. Auth → start session → emit positions (via batch endpoint) → finish session → verify DB state
2. Start session → auto-assigned to group → second user joins same group
3. Finish session with "abandoned" status

**Step 4: Run all tests, commit**

```bash
pnpm --filter @golfix/api test
git commit -m "test: Sprint 2 integration tests — auth, spatial, session flow"
```

---

### Task 12: Wire Simulation Plugin to PositionBuffer

**Files:**
- Modify: `apps/api/src/simulation/simulation-plugin.ts`

**Step 1: Update handlePosition callback**

Replace the `TODO` comment with actual PositionBuffer integration:

```typescript
// Import PositionBuffer, call buffer.add(event) in handlePosition
```

**Step 2: Test**

```bash
DEV_SIMULATE=true DEV_SIM_SPEED=60 pnpm dev:api
# Verify positions appear in DB after 2s flush
```

**Step 3: Commit**

```bash
git commit -m "feat(simulation): wire dev mode to PositionBuffer for DB persistence"
```

---

### Task 13: Update PLAN.md + CLAUDE.md

**Step 1: Update tracking headers**

- PLAN.md: `Last completed task: 2.13 Integration tests — spatial (Sprint 2 complete)`
- CLAUDE.md: same
- MEMORY.md: update sprint status

**Step 2: Commit + push**

```bash
git commit -m "docs: mark Sprint 2 complete"
```

---

## New Dependencies Summary

| Package | Purpose |
|---------|---------|
| `bcrypt` | Password hashing (cost 12) |
| `jsonwebtoken` | JWT sign/verify (HS256) |
| `socket.io` | WebSocket server |
| `@types/bcrypt` | TypeScript types |
| `@types/jsonwebtoken` | TypeScript types |
| `fast-xml-parser` | GPX XML parsing (import tool) |
| `commander` | CLI for import tool |

## Test Strategy

- **Unit tests:** Auth service, PositionBuffer, GPX parser — no DB needed
- **Route tests:** Use `app.inject()` with real DB (seeded) — test HTTP layer
- **Integration tests:** Full flows across multiple endpoints — auth → session → positions
- **DB requirement:** Tests that touch PostGIS need a running PostgreSQL. CI already has Docker.

## Files Modified in app.ts

By the end of Sprint 2, `app.ts` will register these plugins inside the `/api/v1` prefix:

```typescript
api.register(authRoutes, { prefix: "/auth" });
api.register(courseRoutes, { prefix: "/courses" });
api.register(sessionRoutes, { prefix: "/sessions" });
api.register(scoringRoutes, { prefix: "/rounds" });
api.register(positionRoutes, { prefix: "/positions" });
api.register(userRoutes, { prefix: "/users" });
```

And outside the prefix, Socket.io is attached to the HTTP server.
