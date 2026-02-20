# Sprint 6 — Analytics, Polish & Deploy (PWA Focus)

**Date**: 2026-02-20
**Goal**: Deploy the golfer PWA to production with security hardening, GDPR compliance, monitoring, and infrastructure setup.
**Platforms**: Fly.io (API), Vercel (golfer-app), Neon (PostgreSQL + PostGIS)

## Context

Sprint 5 (Dashboard & Notifications) is deferred. This sprint focuses on getting the golfer PWA live for real-world testing. Dashboard-dependent tasks (analytics UI, tee optimizer, full load test, full pilot) are deferred to Sprint 5.

## Session Split

| Session | Tasks | Focus |
|---------|-------|-------|
| 6A | 6.7, 6.8, 6.9, 6.10, 6.1 | Hardening: security, GDPR, retention, monitoring, manager CRUD |
| 6B | 6.11, 6.12, 6.13 | Deployment: Neon + Fly.io + Vercel |
| 6C | 6.14, 6.15 | Validation: load test + pilot prep |

---

## Session 6A — Hardening

### 6.7 Security Audit

Review and tighten existing security configuration.

**Zod schema audit:**
- Verify all request bodies/params validated with Zod across all modules (auth, courses, sessions, positions, scoring, users, tee-times)
- Add max length constraints where missing
- Ensure params (`:slug`, `:courseId`, etc.) are validated, not just cast with `as`

**CORS lockdown:**
- Current: defaults to `localhost:5173/5174` — acceptable for dev
- Production: require explicit `CORS_ORIGIN` env var, no wildcard
- No code change needed (already reads `process.env.CORS_ORIGIN`), just document

**Helmet review:**
- Current: default config (`await app.register(helmet)`)
- Add explicit CSP headers, `crossOriginEmbedderPolicy`, `referrerPolicy`
- Tune for PWA: allow service worker, manifest, etc.

**Rate limit tuning:**
- Global: 100 req/min (already set)
- Auth endpoints: 20/min (already has some)
- Position batch: 20/sec (high-frequency GPS)
- Locate: 30/min (already set)
- New manager CRUD endpoints: 30/min

**Input validation:**
- Verify no raw SQL (all Drizzle = parameterized queries)
- Replace `request.params as { slug: string }` patterns with Zod schema validation

### 6.8 GDPR — Data Export & Deletion

Two new endpoints under `/api/v1/users/me`:

**`GET /users/me/export`** — JSON dump:
- Profile (email, displayName, handicap, preferences, gdprConsentAt)
- All rounds with scores
- All sessions (without raw positions — too large)
- Session summary stats (total distance, duration)
- Response: JSON file download with `Content-Disposition: attachment`

**`DELETE /users/me`** — Account deletion:
- Requires password confirmation for email users (body: `{ password: string }`)
- Anonymous users: no confirmation needed
- Cascade: revoke all refresh tokens → delete scores → delete rounds → delete sessions → anonymize positions (keep for analytics but null out user reference) → delete course roles → delete user
- Returns 204 No Content on success
- Irreversible — warn in response header or require explicit consent param

### 6.9 Position Data Retention

**Cron job** (runs in same Node process):
- Schedule: daily at 3:00 AM (configurable via `RETENTION_CRON` env var)
- Library: `node-cron` (lightweight, no external dependency)
- Logic:
  1. Find sessions with positions older than 12 months
  2. For each session: compute summary stats (total points, first/last timestamp, bounding box)
  3. Store summary in session metadata (new `positionSummary` JSONB field on sessions table, or separate table)
  4. Delete raw position rows
  5. Auto-create next month's partition if it doesn't exist

**Migration**: Add `position_summary` JSONB column to sessions table (nullable).

### 6.10 Monitoring & Logging

**Pino structured logging:**
- Already using pino with `pino-pretty` in dev
- Production: raw JSON (no pino-pretty transport)
- Add request-id correlation via `@fastify/request-context` or fastify's built-in `request.id`
- Redact sensitive fields: `authorization` header, `passwordHash`, `tokenHash`

**Health endpoint enhancement:**
- Current: `GET /api/v1/health` → `{ status: "ok", timestamp }`
- Enhanced: add `db: "connected"` (simple `SELECT 1` check), `uptime`, `version` (from package.json)

**Sentry integration:**
- `@sentry/node` v8+ (ESM-compatible)
- Initialize before Fastify (global error capture)
- Wrap Fastify error handler: report 5xx errors to Sentry
- Environment-based: only active when `SENTRY_DSN` env var is set (noop otherwise)
- Redact PII from error reports (user emails, positions)

### 6.1 Manager CRUD Endpoints

**New middleware**: `requireCourseRole(allowedRoles: CourseRole[])` — checks `courseRoles` table for the authenticated user's role on the target course. Returns 403 if unauthorized.

**Course settings** (owner/admin only):

`PATCH /api/v1/courses/:courseId/settings`
- Body (Zod validated):
  ```ts
  { paceTargetMinutes?: number, teeIntervalMinutes?: number, timezone?: string }
  ```
- Updates course record
- Returns updated course

**Role management** (owner only):

`GET /api/v1/courses/:courseId/roles`
- Returns list of `{ id, userId, role, user: { email, displayName } }`

`POST /api/v1/courses/:courseId/roles`
- Body: `{ email: string, role: "admin" | "marshal" | "viewer" }`
- Finds user by email, creates courseRole entry
- Returns 404 if user not found, 409 if role already exists

`PATCH /api/v1/courses/:courseId/roles/:roleId`
- Body: `{ role: "admin" | "marshal" | "viewer" }`
- Cannot change to "owner" via this endpoint (owner transfer is separate)
- Returns updated role

`DELETE /api/v1/courses/:courseId/roles/:roleId`
- Cannot remove the last owner
- Returns 204 No Content

---

## Session 6B — Deployment

### 6.11 Neon Database Setup

Manual steps (documented checklist, not automated):

1. Create Neon project "golfix-mvp" in EU region (Frankfurt)
2. `CREATE EXTENSION postgis;` on the default database
3. Run migrations: `DATABASE_URL=<neon-pooled-url> pnpm db:migrate`
4. Seed pilot course: `DATABASE_URL=<neon-pooled-url> pnpm db:seed`
5. Store pooled connection string as `DATABASE_URL` for Fly.io

**No code changes** — Drizzle connection already reads `DATABASE_URL` from env.

### 6.12 Fly.io API Deployment

**New files:**

`apps/api/Dockerfile` — Multi-stage Node 22 Alpine build:
- Stage 1 (builder): Copy monorepo root files (pnpm-lock.yaml, pnpm-workspace.yaml, package.json), install all deps, copy source, build all workspaces
- Stage 2 (runner): Copy built dist/ + production node_modules only, expose port 3000
- Handles monorepo workspace dependencies (`@golfix/shared`)

`apps/api/fly.toml`:
- App name: `golfix-api`
- Region: `cdg` (Paris, closest to target users)
- Service: HTTP on internal port 3000
- Health check: `GET /api/v1/health` every 10s
- Memory: 256 MB (free tier)

`apps/api/.dockerignore`:
- Exclude `node_modules/`, `.git/`, `*.test.ts`, `dist/`, `e2e/`

**Fly.io secrets** (set via `fly secrets set`):
- `DATABASE_URL` — Neon pooled connection string
- `JWT_SECRET` — production secret (generate random 64-char hex)
- `CORS_ORIGIN` — Vercel golfer-app URL
- `NODE_ENV=production`
- `SENTRY_DSN` — Sentry project DSN (optional)

**Socket.io**: Works natively on Fly.io persistent VMs. No special proxy config needed.

### 6.13 Vercel Golfer App Deployment

**Vercel project setup:**
- Connect GitHub repo
- Root directory: `apps/golfer-app`
- Build command: `cd ../.. && pnpm install && pnpm --filter @golfix/shared build && pnpm --filter @golfix/golfer-app build`
- Output directory: `dist`
- Install command: (handled by build command)

**New file**: `apps/golfer-app/vercel.json`
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Environment variables** (Vercel dashboard):
- `VITE_API_URL` — Fly.io API URL (e.g., `https://golfix-api.fly.dev`)
- `VITE_SOCKET_URL` — Same as API URL (Socket.io on same origin)

---

## Session 6C — Validation

### 6.14 Load Testing (API-only)

**Tool**: k6 (Grafana) or custom Node.js script with `ws` + `fetch`

**Scenarios:**
1. **Position throughput**: 50 concurrent sessions, each sending position batch every 3s → verify batch endpoint handles 50 req/3s = ~17 req/s sustained
2. **WebSocket stability**: 50 concurrent Socket.io connections, verify no disconnections over 10 min
3. **Neon pool**: Monitor connection count during load (Neon free tier: 5 concurrent connections via pooler)
4. **Cold start recovery**: Kill the Fly.io VM, measure time to first healthy response

**Success criteria:**
- Position batch p95 latency < 500ms
- Zero WebSocket disconnections during sustained load
- No Neon connection pool exhaustion errors

### 6.15 Pilot Preparation (partial)

End-to-end golfer walkthrough on real mobile device (Chrome on Android):

1. Open PWA URL → GDPR consent modal appears
2. Register with email → login succeeds
3. GPS permission → course detected
4. Start session → GPS distances visible
5. Score entry → scorecard updates
6. End session → round summary displays
7. Profile → notification preferences toggle works
8. PWA install → app installs to home screen
9. Offline → position queue buffers, reconnects

**Deliverable**: Document issues found, fix critical blockers.

---

## Deferred Tasks (Sprint 5 dependency)

| Task | Reason deferred |
|------|----------------|
| 6.2 Pace trends (UI) | Needs dashboard scaffold (5.2) |
| 6.3 Bottleneck heatmap (UI) | Needs Mapbox map (5.3) |
| 6.4 Round distributions (UI) | Needs dashboard scaffold (5.2) |
| 6.5 Tee interval optimizer | Needs dashboard UI for recommendations |
| 6.6 Analytics endpoints | Backend can come with Sprint 5 |
| 6.13 Dashboard deploy | Dashboard doesn't exist yet |
| 6.14 Full load test | Cannot test dashboard aggregation loop |
| 6.15 Full pilot | Cannot test manager-side flow |

---

## Technical Decisions

- **API hosting**: Fly.io (persistent VMs, no cold starts, free tier with credit card)
- **Frontend hosting**: Vercel (free tier, SPA routing, auto-deploys from GitHub)
- **Database**: Neon (PostgreSQL 16 + PostGIS, pooled connections, EU region)
- **Error tracking**: Sentry (opt-in via `SENTRY_DSN` env var)
- **Position retention**: 12-month raw data, then aggregated summary
- **GDPR deletion**: Hard delete user + cascade, anonymize positions
