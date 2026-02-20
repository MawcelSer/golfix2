# Sprint 6 — Deploy & Harden Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the golfer PWA to production (Fly.io + Vercel + Neon) with security hardening, GDPR compliance, monitoring, and manager CRUD endpoints.

**Architecture:** API hardening (security, GDPR, monitoring) first, then Dockerfile + fly.toml for Fly.io deployment, Vercel for PWA. Manager CRUD uses existing `requireRole` middleware with new course settings/role endpoints.

**Tech Stack:** Fastify, Drizzle ORM, Zod, pino, @sentry/node, node-cron, Fly.io, Vercel, Neon (PostgreSQL + PostGIS)

---

## Session 6A — Hardening (Tasks 1-14)

### Task 1: Security audit — Zod param validation

Replace `request.params as { ... }` casts with Zod-validated params across all route files.

**Files:**
- Modify: `apps/api/src/courses/course-routes.ts`
- Modify: `apps/api/src/courses/course-schemas.ts`
- Modify: `apps/api/src/sessions/session-routes.ts`
- Modify: `apps/api/src/sessions/session-schemas.ts`
- Modify: `apps/api/src/scoring/scoring-routes.ts`
- Modify: `apps/api/src/scoring/scoring-schemas.ts`
- Modify: `apps/api/src/positions/position-routes.ts`
- Modify: `apps/api/src/tee-times/tee-time-routes.ts`
- Modify: `apps/api/src/tee-times/tee-time-schemas.ts`

**Step 1: Add param schemas to each schema file**

Add `z.object({ slug: z.string().min(1).max(100) })` for course params, `z.object({ id: z.string().uuid() })` for ID params, etc.

Example for `course-schemas.ts`:
```ts
export const courseSlugParamSchema = z.object({
  slug: z.string().min(1).max(100),
});
```

Example for `session-schemas.ts`:
```ts
export const sessionIdParamSchema = z.object({
  id: z.string().uuid(),
});
```

**Step 2: Replace `as` casts in route handlers with Zod `.safeParse(request.params)`**

Pattern in each route handler:
```ts
const parsed = courseSlugParamSchema.safeParse(request.params);
if (!parsed.success) {
  return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
}
const { slug } = parsed.data;
```

**Step 3: Run existing tests to ensure nothing breaks**

Run: `cd apps/api && pnpm test`
Expected: All tests pass (existing behavior unchanged)

**Step 4: Commit**

```
feat(api): validate route params with Zod schemas
```

---

### Task 2: Security audit — Helmet CSP + rate limit tuning

**Files:**
- Modify: `apps/api/src/app.ts`

**Step 1: Update Helmet config with explicit CSP**

```ts
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:", "https:"],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // Required for PWA
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});
```

Note: `crossOriginEmbedderPolicy: false` is needed for service worker and manifest loading in PWA.

**Step 2: Run tests**

Run: `cd apps/api && pnpm test`
Expected: All pass. Helmet changes don't affect unit tests.

**Step 3: Commit**

```
feat(api): harden Helmet CSP and referrer policy
```

---

### Task 3: GDPR data export — write test

**Files:**
- Create: `apps/api/src/users/__tests__/gdpr.test.ts`

**Step 1: Write the failing test for `GET /users/me/export`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database and auth
vi.mock("../../db/connection", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue([]),
    orderBy: vi.fn().mockReturnValue([]),
  },
}));

vi.mock("../../auth/auth-service", () => ({
  verifyAccessToken: vi.fn().mockReturnValue({ sub: "user-1" }),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

describe("GDPR export", () => {
  it("returns user data as JSON for authenticated user", async () => {
    // Build app, inject request to GET /api/v1/users/me/export
    // Assert 200, Content-Type application/json, Content-Disposition attachment
    // Assert response contains user profile, rounds, sessions
  });

  it("returns 401 for unauthenticated request", async () => {
    // Assert 401
  });
});
```

Write full test file with `buildApp()` + `app.inject()` pattern matching existing test files (see `apps/api/src/users/__tests__/user-routes.test.ts` for pattern).

**Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test src/users/__tests__/gdpr.test.ts`
Expected: FAIL — export endpoint doesn't exist yet

---

### Task 4: GDPR data export — implement endpoint

**Files:**
- Create: `apps/api/src/users/gdpr-service.ts`
- Modify: `apps/api/src/users/user-routes.ts`

**Step 1: Implement `exportUserData(userId)` in gdpr-service.ts**

Query all user data:
- User profile (email, displayName, handicap, preferences, gdprConsentAt)
- Rounds with scores (JOIN rounds → scores)
- Sessions (id, courseId, startedAt, finishedAt, status — no raw positions)

Return as structured JSON object.

**Step 2: Add `GET /users/me/export` route in user-routes.ts**

```ts
app.get("/users/me/export", {
  handler: async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Authentication required", statusCode: 401 });
    }
    const data = await exportUserData(request.userId);
    return reply
      .header("Content-Disposition", 'attachment; filename="golfix-data-export.json"')
      .header("Content-Type", "application/json")
      .status(200)
      .send(data);
  },
});
```

**Step 3: Run test**

Run: `cd apps/api && pnpm test src/users/__tests__/gdpr.test.ts`
Expected: PASS

**Step 4: Commit**

```
feat(api): add GDPR data export endpoint
```

---

### Task 5: GDPR account deletion — write test

**Files:**
- Modify: `apps/api/src/users/__tests__/gdpr.test.ts`

**Step 1: Add deletion tests**

```ts
describe("GDPR deletion", () => {
  it("deletes email user with correct password confirmation", async () => {
    // POST /api/v1/users/me with body { password: "..." }
    // Assert 204 No Content
  });

  it("deletes anonymous user without password", async () => {
    // DELETE /api/v1/users/me with no body
    // Assert 204
  });

  it("rejects deletion with wrong password", async () => {
    // DELETE /api/v1/users/me with wrong password
    // Assert 403
  });

  it("returns 401 for unauthenticated request", async () => {
    // Assert 401
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test src/users/__tests__/gdpr.test.ts`
Expected: FAIL — delete endpoint doesn't exist

---

### Task 6: GDPR account deletion — implement endpoint

**Files:**
- Modify: `apps/api/src/users/gdpr-service.ts`
- Modify: `apps/api/src/users/user-routes.ts`
- Modify: `apps/api/src/users/user-schemas.ts`

**Step 1: Add `deleteAccountSchema` to user-schemas.ts**

```ts
export const deleteAccountSchema = z.object({
  password: z.string().min(1).optional(),
});
```

**Step 2: Implement `deleteUserAccount(userId, password?)` in gdpr-service.ts**

Transaction:
1. Fetch user (email + passwordHash)
2. If user has email+password: verify password, reject if wrong
3. Delete in order: scores (via rounds) → rounds → sessions → refresh_tokens → course_roles → user
4. For positions: UPDATE positions SET session_id = session_id (keep rows but they're orphaned when session is deleted — or keep sessions with userId NULLed)

Approach: NULL out `userId` on sessions before deleting user, keeping position data for analytics but breaking the user link.

```ts
export async function deleteUserAccount(userId: string, password?: string): Promise<void> {
  return db.transaction(async (tx) => {
    // 1. Verify user & password
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new UserNotFoundError(userId);

    if (user.passwordHash) {
      if (!password) throw new PasswordRequiredError();
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) throw new InvalidPasswordError();
    }

    // 2. Delete scores (via rounds)
    const userRounds = await tx.select({ id: rounds.id }).from(rounds).where(eq(rounds.userId, userId));
    const roundIds = userRounds.map(r => r.id);
    if (roundIds.length > 0) {
      await tx.delete(scores).where(inArray(scores.roundId, roundIds));
    }
    await tx.delete(rounds).where(eq(rounds.userId, userId));

    // 3. Anonymize sessions (keep positions for analytics)
    await tx.update(sessions).set({ userId: sql`NULL` }).where(eq(sessions.userId, userId));
    // Note: this requires making sessions.userId nullable — see migration

    // 4. Delete refresh tokens
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    // 5. Delete course roles
    await tx.delete(courseRoles).where(eq(courseRoles.userId, userId));

    // 6. Delete user
    await tx.delete(users).where(eq(users.id, userId));
  });
}
```

**Important**: Sessions table has `userId NOT NULL`. We need a migration to make it nullable for GDPR anonymization.

**Step 3: Add migration for nullable sessions.userId**

Run: `cd apps/api && pnpm db:generate`
Or write manual migration SQL:
```sql
ALTER TABLE sessions ALTER COLUMN user_id DROP NOT NULL;
```

**Step 4: Add `DELETE /users/me` route in user-routes.ts**

**Step 5: Run test**

Run: `cd apps/api && pnpm test src/users/__tests__/gdpr.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat(api): add GDPR account deletion with cascade
```

---

### Task 7: Position data retention — write test

**Files:**
- Create: `apps/api/src/retention/__tests__/retention-job.test.ts`

**Step 1: Write failing test**

```ts
describe("retention job", () => {
  it("aggregates positions older than retention period into session summary", async () => {
    // Mock: session with positions from 13 months ago
    // Run: processRetention()
    // Assert: position rows deleted, session has positionSummary JSONB
  });

  it("skips sessions with positions within retention period", async () => {
    // Mock: session with recent positions
    // Run: processRetention()
    // Assert: positions untouched
  });

  it("handles empty position sets gracefully", async () => {
    // Mock: no old positions
    // Run: processRetention()
    // Assert: no errors, no changes
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test src/retention/__tests__/retention-job.test.ts`
Expected: FAIL — module doesn't exist

---

### Task 8: Position data retention — implement

**Files:**
- Create: `apps/api/src/retention/retention-job.ts`
- Modify: `apps/api/src/server.ts` (start cron)

**Step 1: Add `positionSummary` JSONB column to sessions schema**

Modify `apps/api/src/db/schema/tracking.ts` — add to sessions table:
```ts
positionSummary: jsonb("position_summary"),
```

Generate migration: `cd apps/api && pnpm db:generate`

**Step 2: Implement `processRetention()` function**

```ts
import cron from "node-cron";

const RETENTION_MONTHS = 12;

export async function processRetention(): Promise<{ sessionsProcessed: number; positionsDeleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

  // Find sessions with old positions
  // For each: compute summary (count, first/last timestamp, bounding box)
  // Store summary in session.positionSummary
  // Delete raw position rows
  // Return stats
}

export function startRetentionCron(): void {
  const schedule = process.env.RETENTION_CRON ?? "0 3 * * *"; // daily at 3 AM
  cron.schedule(schedule, async () => {
    // ... run processRetention() with error logging
  });
}
```

**Step 3: Wire cron into server.ts**

Add after `app.listen()`:
```ts
if (process.env.NODE_ENV === "production" || process.env.ENABLE_RETENTION === "true") {
  const { startRetentionCron } = await import("./retention/retention-job");
  startRetentionCron();
}
```

**Step 4: Install node-cron**

Run: `cd apps/api && pnpm add node-cron && pnpm add -D @types/node-cron`

**Step 5: Run tests**

Run: `cd apps/api && pnpm test src/retention/__tests__/retention-job.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat(api): add position data retention cron job
```

---

### Task 9: Monitoring — enhanced health endpoint

**Files:**
- Modify: `apps/api/src/app.ts`

**Step 1: Write test for enhanced health**

Add to `apps/api/src/app.test.ts`:
```ts
it("health check includes db status and uptime", async () => {
  const app = await buildApp();
  const res = await app.inject({ method: "GET", url: "/api/v1/health" });
  const body = JSON.parse(res.body);
  expect(body.status).toBe("ok");
  expect(body).toHaveProperty("uptime");
  expect(body).toHaveProperty("version");
});
```

**Step 2: Enhance health endpoint in app.ts**

```ts
api.get("/health", async () => {
  let dbStatus = "connected";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = "disconnected";
  }

  return {
    status: dbStatus === "connected" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? "0.0.0",
    db: dbStatus,
  };
});
```

**Step 3: Run tests**

Run: `cd apps/api && pnpm test src/app.test.ts`
Expected: PASS

**Step 4: Commit**

```
feat(api): enhance health endpoint with db check and uptime
```

---

### Task 10: Monitoring — Sentry integration

**Files:**
- Create: `apps/api/src/monitoring/sentry.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`

**Step 1: Install Sentry**

Run: `cd apps/api && pnpm add @sentry/node`

**Step 2: Create sentry.ts initialization module**

```ts
import * as Sentry from "@sentry/node";

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // Noop if no DSN configured

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Redact PII
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}
```

**Step 3: Initialize Sentry before Fastify in server.ts**

Add at top of `start()`:
```ts
const { initSentry } = await import("./monitoring/sentry");
initSentry();
```

**Step 4: Wire captureError into app.ts error handler**

```ts
import { captureError } from "./monitoring/sentry";

// In setErrorHandler:
if (statusCode >= 500) {
  captureError(error, { statusCode });
}
```

**Step 5: Run tests (Sentry is noop without SENTRY_DSN)**

Run: `cd apps/api && pnpm test`
Expected: All pass (Sentry disabled in tests)

**Step 6: Commit**

```
feat(api): add Sentry error tracking (opt-in via SENTRY_DSN)
```

---

### Task 11: Monitoring — pino log redaction

**Files:**
- Modify: `apps/api/src/app.ts`

**Step 1: Add pino redaction config**

Update Fastify logger options:
```ts
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie"],
      censor: "[REDACTED]",
    },
  },
});
```

**Step 2: Run tests**

Run: `cd apps/api && pnpm test`
Expected: All pass

**Step 3: Commit**

```
feat(api): redact sensitive headers in pino logs
```

---

### Task 12: Manager CRUD — course settings endpoint (write test)

**Files:**
- Create: `apps/api/src/courses/__tests__/course-settings.test.ts`
- Create: `apps/api/src/courses/course-settings-schemas.ts`

**Step 1: Write failing test**

```ts
describe("PATCH /api/v1/courses/:courseId/settings", () => {
  it("updates pace target for course owner", async () => {
    // Mock: user with 'owner' role on course
    // PATCH with { paceTargetMinutes: 240 }
    // Assert 200, returned course has updated paceTargetMinutes
  });

  it("returns 403 for viewer role", async () => {
    // Mock: user with 'viewer' role
    // Assert 403
  });

  it("validates input (rejects negative pace target)", async () => {
    // PATCH with { paceTargetMinutes: -5 }
    // Assert 400
  });
});
```

**Step 2: Add Zod schema in course-settings-schemas.ts**

```ts
import { z } from "zod";

export const updateCourseSettingsSchema = z
  .object({
    paceTargetMinutes: z.number().int().min(60).max(600).optional(),
    teeIntervalMinutes: z.number().int().min(5).max(30).optional(),
    timezone: z.string().min(1).max(50).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one setting must be provided",
  });

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid(),
});
```

**Step 3: Run test to verify it fails**

Run: `cd apps/api && pnpm test src/courses/__tests__/course-settings.test.ts`
Expected: FAIL

---

### Task 13: Manager CRUD — course settings + role management (implement)

**Files:**
- Create: `apps/api/src/courses/course-settings-service.ts`
- Create: `apps/api/src/courses/course-settings-routes.ts`
- Create: `apps/api/src/courses/course-role-schemas.ts`
- Create: `apps/api/src/courses/course-role-service.ts`
- Modify: `apps/api/src/app.ts` (register new routes)

**Step 1: Implement course settings service**

```ts
export async function updateCourseSettings(
  courseId: string,
  update: { paceTargetMinutes?: number; teeIntervalMinutes?: number; timezone?: string },
): Promise<CourseSettingsResponse> {
  const [updated] = await db
    .update(courses)
    .set(update)
    .where(eq(courses.id, courseId))
    .returning({
      id: courses.id,
      paceTargetMinutes: courses.paceTargetMinutes,
      teeIntervalMinutes: courses.teeIntervalMinutes,
      timezone: courses.timezone,
    });
  if (!updated) throw new CourseNotFoundError(courseId);
  return updated;
}
```

**Step 2: Implement role management service**

Functions:
- `listCourseRoles(courseId)` — SELECT courseRoles JOIN users (email, displayName)
- `assignCourseRole(courseId, email, role)` — Find user by email, INSERT courseRole
- `updateCourseRole(roleId, newRole)` — UPDATE courseRoles
- `removeCourseRole(roleId, courseId)` — Check not last owner, then DELETE

**Step 3: Create route file with all endpoints**

```ts
export async function courseSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifyToken);

  // PATCH /settings — owner/admin
  app.patch("/settings", {
    preHandler: requireRole("owner", "admin"),
    handler: async (request, reply) => { /* ... */ },
  });

  // GET /roles — owner/admin
  // POST /roles — owner only
  // PATCH /roles/:roleId — owner only
  // DELETE /roles/:roleId — owner only
}
```

**Step 4: Register in app.ts**

```ts
const { courseSettingsRoutes } = await import("./courses/course-settings-routes");
await api.register(courseSettingsRoutes, { prefix: "/courses/:courseId" });
```

**Step 5: Run tests**

Run: `cd apps/api && pnpm test`
Expected: All pass

**Step 6: Commit**

```
feat(api): add manager CRUD — course settings and role management
```

---

### Task 14: Session 6A validation

**Step 1: Run full validation**

Run: `pnpm validate` (lint + format + typecheck + build)
Fix any issues.

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All pass (192+ API tests + new GDPR/settings/retention tests)

**Step 3: Commit any fixes**

```
fix(api): session 6A validation fixes
```

---

## Session 6B — Deployment (Tasks 15-20)

### Task 15: Dockerfile for API

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`

**Step 1: Write Dockerfile**

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

# Build
RUN pnpm --filter @golfix/shared build && pnpm --filter @golfix/api build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "apps/api/dist/server.js"]
```

**Step 2: Write .dockerignore**

```
node_modules
dist
*.test.ts
__tests__
.git
```

**Step 3: Test Docker build locally**

Run: `docker build -f apps/api/Dockerfile -t golfix-api .`
Expected: Build succeeds

**Step 4: Test Docker run locally**

Run: `docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_SECRET=test golfix-api`
Verify: `curl http://localhost:3000/api/v1/health` returns `{ status: "ok" }`

**Step 5: Commit**

```
feat(api): add Dockerfile for production deployment
```

---

### Task 16: Fly.io configuration

**Files:**
- Create: `apps/api/fly.toml`

**Step 1: Write fly.toml**

```toml
app = "golfix-api"
primary_region = "cdg"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/api/v1/health"
  timeout = "5s"

[env]
  NODE_ENV = "production"
  LOG_LEVEL = "info"
```

Note: `min_machines_running = 1` keeps one VM alive (no cold starts). Free tier allows this.

**Step 2: Commit**

```
feat(api): add Fly.io configuration
```

---

### Task 17: Deploy API to Fly.io

**Prerequisite**: User must have `flyctl` installed and authenticated (`fly auth login`).

**Step 1: Create Fly.io app**

Run: `cd apps/api && fly apps create golfix-api`

**Step 2: Set secrets**

Run:
```bash
fly secrets set DATABASE_URL="<neon-pooled-url>" \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CORS_ORIGIN="https://golfix-golfer.vercel.app" \
  SENTRY_DSN="<optional>"
```

**Step 3: Deploy**

Run: `cd apps/api && fly deploy --dockerfile Dockerfile --build-context ../..`

Note: Build context must be monorepo root since Dockerfile references `packages/shared/`.

Alternative if context flag is tricky: copy Dockerfile to root and deploy from there:
```bash
cp apps/api/Dockerfile . && fly deploy --config apps/api/fly.toml && rm Dockerfile
```

**Step 4: Verify**

Run: `curl https://golfix-api.fly.dev/api/v1/health`
Expected: `{ "status": "ok", "db": "connected", "uptime": ... }`

**Step 5: Test WebSocket**

Quick test with wscat or browser console:
```js
const socket = io("https://golfix-api.fly.dev");
socket.on("connect", () => console.log("connected!"));
```

---

### Task 18: Neon database setup

**Prerequisite**: User has Neon account.

**Step 1: Create Neon project**

- Name: `golfix-mvp`
- Region: `eu-central-1` (Frankfurt)
- PostgreSQL 16

**Step 2: Enable PostGIS**

Run (via Neon SQL editor or psql):
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Step 3: Run migrations**

Run: `DATABASE_URL="<neon-pooled-url>" pnpm db:migrate`

**Step 4: Seed pilot course**

Run: `DATABASE_URL="<neon-pooled-url>" pnpm db:seed`

**Step 5: Verify**

Run: `DATABASE_URL="<neon-pooled-url>" psql -c "SELECT name FROM courses;"`

---

### Task 19: Vercel golfer-app deployment

**Files:**
- Create: `apps/golfer-app/vercel.json`

**Step 1: Write vercel.json for SPA routing**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Step 2: Commit**

```
feat(golfer-app): add Vercel SPA routing config
```

**Step 3: Configure Vercel project**

Via Vercel dashboard or CLI:
- Import GitHub repo
- Root directory: `apps/golfer-app`
- Build command: `cd ../.. && pnpm install && pnpm --filter @golfix/shared build && pnpm --filter @golfix/golfer-app build`
- Output directory: `dist`
- Environment variables:
  - `VITE_API_URL` = `https://golfix-api.fly.dev`
  - `VITE_SOCKET_URL` = `https://golfix-api.fly.dev`

**Step 4: Trigger deploy**

Push to main or trigger via Vercel dashboard.

**Step 5: Verify**

Open the Vercel URL in mobile Chrome. Verify:
- App loads
- GDPR consent modal appears
- Can navigate between tabs

---

### Task 20: Session 6B validation + CORS update

**Step 1: Update CORS_ORIGIN on Fly.io**

Once Vercel URL is known (e.g., `golfix-golfer.vercel.app`):
```bash
fly secrets set CORS_ORIGIN="https://golfix-golfer.vercel.app"
```

**Step 2: Full e2e verification**

Open Vercel PWA URL → login → verify API calls succeed (no CORS errors).

**Step 3: Commit any remaining fixes**

---

## Session 6C — Validation (Tasks 21-23)

### Task 21: Load testing script

**Files:**
- Create: `tools/load-test/load-test.ts`
- Modify: `tools/load-test/package.json` (if creating as workspace package)

Alternatively, use a simple standalone script (no new package):

**Step 1: Write load test script**

```ts
// tools/load-test.ts — run with: npx tsx tools/load-test.ts <api-url>
import { io } from "socket.io-client";

const API_URL = process.argv[2] ?? "https://golfix-api.fly.dev";
const CONCURRENT = 50;
const DURATION_MS = 60_000; // 1 minute

async function simulateSession(index: number) {
  // 1. Login (anonymous)
  // 2. Start session
  // 3. Send position batch every 3s
  // 4. Connect Socket.io
  // 5. Report latency stats
}

async function main() {
  const sessions = Array.from({ length: CONCURRENT }, (_, i) => simulateSession(i));
  const results = await Promise.allSettled(sessions);
  // Report: success rate, p50/p95/p99 latency, WS disconnections
}
```

**Step 2: Run load test against deployed API**

Run: `npx tsx tools/load-test.ts https://golfix-api.fly.dev`

**Success criteria:**
- Position batch p95 < 500ms
- Zero unrecoverable WebSocket disconnections
- No 5xx errors

**Step 3: Commit**

```
test: add load testing script for API
```

---

### Task 22: Pilot walkthrough

Manual test on real mobile device (Chrome on Android):

**Checklist:**
1. [ ] Open PWA URL → GDPR consent modal
2. [ ] Accept GDPR → login/register screen
3. [ ] Register with email → success
4. [ ] GPS permission → course detected (or "no course found" if not at course)
5. [ ] Install PWA via banner → app on home screen
6. [ ] Profile → notification prefs toggle
7. [ ] Profile → logout
8. [ ] Anonymous login → works
9. [ ] Data export → downloads JSON file
10. [ ] Account deletion → account removed

Document any issues found.

---

### Task 23: Final validation and PR

**Step 1: Full validation**

```bash
pnpm validate
pnpm test
cd apps/golfer-app && pnpm test:e2e
```

**Step 2: Update PLAN.md and CLAUDE.md**

Update "Current sprint" to Sprint 5 (next), "Last completed task" to Sprint 6 deployment.

**Step 3: Create PR**

```bash
gh pr create --title "feat: Sprint 6 — Deploy & Harden" --body "..."
```

---

## Dependencies

```
Task 1 (param validation) → no deps
Task 2 (Helmet/rate limits) → no deps
Task 3-4 (GDPR export) → no deps
Task 5-6 (GDPR delete) → depends on Task 3-4
Task 7-8 (retention) → no deps
Task 9 (health endpoint) → no deps
Task 10 (Sentry) → no deps
Task 11 (pino redaction) → no deps
Task 12-13 (manager CRUD) → depends on Task 1 (param schemas)
Task 14 (6A validation) → depends on Tasks 1-13
Task 15-16 (Dockerfile + fly.toml) → depends on Task 14
Task 17 (Fly.io deploy) → depends on Tasks 15-16, 18
Task 18 (Neon setup) → no code deps, can run in parallel
Task 19 (Vercel deploy) → depends on Task 17 (need API URL)
Task 20 (6B validation) → depends on Tasks 17-19
Task 21 (load test) → depends on Task 20
Task 22 (pilot) → depends on Task 20
Task 23 (final) → depends on all
```

## New dependencies to install

```bash
cd apps/api && pnpm add node-cron @sentry/node
cd apps/api && pnpm add -D @types/node-cron
```
