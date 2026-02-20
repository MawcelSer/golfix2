# Golfix — Implementation Plan

> Real-time golf course management platform: GPS distances, pace tracking, course manager dashboard.

**Current sprint:** Sprint 5 — Dashboard & Notifications (complete)
**Last completed task:** 5D.3 Build config, docs, validate (Sprint 5 complete)

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Project name | Golfix | Canonical name across all packages |
| Package manager | pnpm | Fast installs, strict isolation, good monorepo support |
| ORM / Migrations | Drizzle ORM | TypeScript-first, auto-generated migrations, raw SQL escape hatch for PostGIS |
| Auth model | Hybrid: `users` + `course_roles` | Single login flow, flexible RBAC, supports multi-course managers |
| JWT algorithm | HS256 (MVP) | Simpler setup. **Post-MVP: migrate to RS256** for cross-service verification |
| Password hashing | bcrypt, cost 12 | Well-supported across deployments. **Post-MVP: evaluate argon2id** |
| Test runner | Vitest | Same runner across monorepo (backend + frontend), native ESM/TS |
| Map library | Mapbox GL JS | Best satellite imagery, smooth performance, free tier (50k loads/month) sufficient for pilot |
| GPS buffer | In-memory batch + pluggable interface | `PositionBuffer` interface, swap to Redis when multi-server needed |
| Offline position queue | IndexedDB on client | Buffer positions when signal lost, replay on reconnect. Critical for real-world usage |
| App strategy | PWA first, Capacitor later | PWA works well on Android. Accept iOS background GPS limitations. Add Capacitor when needed |
| Monorepo layout | `apps/` + `packages/` | Clear separation: deployable apps vs shared libraries |
| Linting | ESLint + Prettier | Industry standard, well-supported |
| UI language | French only (MVP) | Target French market. i18n later |
| CLI tool name | `golfix` | `npx golfix import-course --gpx course.gpx` |
| API versioning | `/api/v1/` prefix | Easy to add now, painful to retrofit once clients are deployed |
| Socket.io rooms | Separate ingestion + dashboard rooms | Golfers write to `course:${id}:positions`, dashboard reads from `course:${id}:dashboard` (aggregated) |
| CI/CD | GitHub Actions | Lint, typecheck, test on every PR from Sprint 1 |
| Rate limiting | `@fastify/rate-limit` | Auth endpoints from Sprint 1, general + position limits on deploy |

---

## Architecture Overview

```
┌──────────────┐     WebSocket (5s)      ┌─────────────────┐
│  Golfer PWA  │ ──────────────────────── │  Fastify API    │
│  React+Vite  │     REST (auth, scores)  │  Node.js + TS   │
└──────────────┘                          │                 │
                                          │  Socket.io      │
┌──────────────┐     WebSocket (live)     │  Pace Engine    │
│  Dashboard   │ ──────────────────────── │                 │
│  React+Vite  │     REST (reports, CRUD) │  PositionBuffer │
└──────────────┘                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  PostgreSQL 16   │
                                          │  + PostGIS 3.4   │
                                          └─────────────────┘
```

### Socket.io Room Strategy

Golfers and the dashboard use separate room types to avoid flooding the dashboard with raw GPS data:

- **`course:${id}:positions`** — Golfers write `position:update` events here. Server processes and buffers.
- **`course:${id}:dashboard`** — Server emits aggregated group state every 5s. Dashboard subscribes here.

This prevents 50 golfers x 1 msg/5s = 10 msg/sec of raw GPS data from hitting the dashboard directly.

### Spatial Query Division

- **Client-side Haversine**: Real-time distance display (fast, works offline from cached geodata)
- **Client-side geofence check**: Hole detection from cached polygons (faster than server roundtrip)
- **Server-side PostGIS**: Initial course detection (`ST_Within`), position ingestion hole detection, analytics queries

### Monorepo Structure

```
golfix/
├── apps/
│   ├── api/                    # Fastify backend
│   │   └── src/
│   │       ├── routes/         # REST endpoints (/api/v1/...)
│   │       ├── ws/             # Socket.io handlers
│   │       ├── services/       # Business logic (pace engine, etc.)
│   │       ├── db/             # Drizzle schema, migrations, queries
│   │       └── types/          # API-specific types
│   ├── dashboard/              # React + Vite (manager web app)
│   │   └── src/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── pages/
│   │       └── services/
│   └── golfer-app/             # React + Vite (PWA → Capacitor later)
│       └── src/
│           ├── components/
│           ├── hooks/
│           └── services/
├── packages/
│   ├── shared/                 # Shared TS types & utilities
│   │   └── src/
│   │       ├── types/          # Domain types (Course, Hole, Session, etc.)
│   │       ├── schemas/        # Zod validation schemas
│   │       └── utils/          # Haversine, formatters, constants
│   ├── ui/                     # Shared React hooks & API client (populated Sprint 5)
│   │   └── src/
│   │       ├── hooks/          # useAuth, useApi, useSocket
│   │       └── api/            # Typed API client
│   └── eslint-config/          # Shared ESLint configuration
├── tools/
│   └── import-course/          # GPX import CLI
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   └── nginx.conf
├── .github/
│   └── workflows/              # CI pipeline (lint, typecheck, test)
├── package.json                # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── PLAN.md
```

---

## Database Schema

### Tables

**users** — All authenticated users (golfers + managers)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE, nullable | Optional for golfers |
| display_name | VARCHAR(100) | |
| password_hash | VARCHAR(255), nullable | bcrypt, cost 12 |
| device_id | VARCHAR(100), nullable | Anonymous users |
| handicap_index | DECIMAL(3,1), nullable | WHS range: -10.0 to +54.0 |
| push_token | VARCHAR(500), nullable | FCM token |
| push_subscription | JSONB, nullable | Web Push (managers) |
| notification_prefs | JSONB DEFAULT '{"pace_reminders": true}' | Opt-out support |
| gdpr_consent_at | TIMESTAMPTZ, nullable | When GPS tracking consent was given |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| **CHECK** | | `email IS NOT NULL OR device_id IS NOT NULL` |

**course_roles** — RBAC for course management
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| course_id | UUID FK → courses | |
| role | ENUM(owner, admin, marshal, viewer) | owner = created the course |
| created_at | TIMESTAMPTZ | |
| **UNIQUE**(user_id, course_id) | | One role per user per course |

**courses** — Golf courses
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR(200) | |
| slug | VARCHAR(100) UNIQUE | URL-friendly identifier |
| boundary | GEOMETRY(Polygon, 4326) | Course boundary polygon |
| address | VARCHAR(500), nullable | |
| city | VARCHAR(100), nullable | |
| country | VARCHAR(2) DEFAULT 'FR' | ISO 3166-1 alpha-2 |
| holes_count | SMALLINT | 9 or 18 |
| par | SMALLINT | Total par for the course |
| pace_target_minutes | SMALLINT | Target total round duration (e.g. 255 for 4h15) |
| tee_interval_minutes | SMALLINT DEFAULT 8 | Minutes between tee times |
| timezone | VARCHAR(50) DEFAULT 'Europe/Paris' | IANA timezone |
| data_version | INTEGER DEFAULT 1 | Incremented on geodata change (cache invalidation) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**holes** — Individual holes
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| course_id | UUID FK → courses | |
| hole_number | SMALLINT | 1-18 |
| par | SMALLINT | 3, 4, or 5 |
| stroke_index | SMALLINT | Handicap stroke index 1-18 |
| distance_meters | SMALLINT | Tee to green center |
| geofence | GEOMETRY(Polygon, 4326) | Hole boundary for detection |
| tee_position | GEOMETRY(Point, 4326) | Tee box center |
| green_center | GEOMETRY(Point, 4326) | Center of green |
| green_front | GEOMETRY(Point, 4326) | Front edge |
| green_back | GEOMETRY(Point, 4326) | Back edge |
| pace_target_minutes | SMALLINT, nullable | Per-hole override (null = derive from par) |
| transition_minutes | SMALLINT DEFAULT 1 | Walk time from this green to next tee (e.g. 3 for Hole 7→8 at pilot) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| **UNIQUE**(course_id, hole_number) | | |

**hazards** — Course hazards (bunkers, water, OB, etc.)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| hole_id | UUID FK → holes | |
| type | ENUM(bunker, water, ob, lateral, tree_line) | |
| name | VARCHAR(100), nullable | e.g. "Lac du 7" |
| geometry | GEOMETRY(Polygon, 4326) | Hazard boundary |
| carry_point | GEOMETRY(Point, 4326), nullable | Point to carry over |
| created_at | TIMESTAMPTZ | |

**tee_times** — Scheduled tee times
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| course_id | UUID FK → courses | |
| scheduled_at | TIMESTAMPTZ | Tee time |
| players_count | SMALLINT DEFAULT 4 | Expected players |
| notes | VARCHAR(500), nullable | |
| created_at | TIMESTAMPTZ | |

**groups** — Auto-detected groups of golfers (created by pace engine)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| course_id | UUID FK → courses | |
| tee_time_id | UUID FK → tee_times, nullable | null for walk-ons |
| date | DATE | Playing date |
| group_number | SMALLINT | Sequential for the day |
| current_hole | SMALLINT, nullable | |
| pace_status | ENUM(ahead, on_pace, attention, behind) DEFAULT 'on_pace' | |
| pace_start_time | TIMESTAMPTZ, nullable | When pace clock started (first tee shot on Hole 1) |
| started_at | TIMESTAMPTZ, nullable | When first player teed off |
| finished_at | TIMESTAMPTZ, nullable | |
| created_at | TIMESTAMPTZ | |

**sessions** — A golfer's active presence on a course
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| course_id | UUID FK → courses | |
| group_id | UUID FK → groups, nullable | Assigned by pace engine |
| started_at | TIMESTAMPTZ | |
| finished_at | TIMESTAMPTZ, nullable | null = still active |
| current_hole | SMALLINT, nullable | Last detected hole |
| status | ENUM(active, finished, abandoned) DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**positions** — GPS positions (partitioned by month on `created_at`)
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL | Partition-local PK |
| session_id | UUID FK → sessions | |
| location | GEOMETRY(Point, 4326) | GPS position |
| accuracy | REAL | GPS accuracy in meters |
| recorded_at | TIMESTAMPTZ | Client-side timestamp |
| created_at | TIMESTAMPTZ DEFAULT NOW() | Server-side, partition key |

> Partitions created monthly: `positions_2026_01`, `positions_2026_02`, etc.
> Automate partition creation via cron job or pg_partman.

**rounds** — Scorecards
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| session_id | UUID FK → sessions, nullable | Link to tracking session |
| course_id | UUID FK → courses | |
| started_at | TIMESTAMPTZ | |
| finished_at | TIMESTAMPTZ, nullable | |
| total_score | SMALLINT, nullable | Computed from scores |
| total_putts | SMALLINT, nullable | |
| status | ENUM(in_progress, completed, abandoned) DEFAULT 'in_progress' | |
| created_at | TIMESTAMPTZ | |

**scores** — Per-hole scores (child of rounds)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| round_id | UUID FK → rounds | |
| hole_number | SMALLINT | 1-18 |
| strokes | SMALLINT | |
| putts | SMALLINT, nullable | |
| fairway_hit | BOOLEAN, nullable | FIR |
| green_in_regulation | BOOLEAN, nullable | GIR |
| **UNIQUE**(round_id, hole_number) | | |

**pace_events** — Generated by pace engine
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| course_id | UUID FK → courses | |
| group_id | UUID FK → groups, nullable | |
| type | ENUM(behind_pace, gap_compression, gap_severe, bottleneck, reminder_sent) | |
| severity | ENUM(info, warning, critical) | |
| hole_number | SMALLINT, nullable | |
| details | JSONB | Event-specific data |
| acknowledged_by | UUID FK → users, nullable | Manager who acted |
| created_at | TIMESTAMPTZ | |

**refresh_tokens** — JWT refresh token tracking
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| token_hash | VARCHAR(255) | SHA-256 of refresh token |
| expires_at | TIMESTAMPTZ | 7 days from creation |
| revoked_at | TIMESTAMPTZ, nullable | Set on logout / forced revocation |
| created_at | TIMESTAMPTZ | |

### Indexes

```sql
-- Spatial indexes (auto-created by PostGIS, verify in migration)
CREATE INDEX idx_courses_boundary ON courses USING GIST(boundary);
CREATE INDEX idx_holes_geofence ON holes USING GIST(geofence);
CREATE INDEX idx_holes_green_center ON holes USING GIST(green_center);
CREATE INDEX idx_hazards_geometry ON hazards USING GIST(geometry);

-- Foreign key lookups
CREATE INDEX idx_course_roles_user ON course_roles(user_id);
CREATE INDEX idx_course_roles_course ON course_roles(course_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_course_status ON sessions(course_id, status);
CREATE INDEX idx_positions_session ON positions(session_id);
CREATE INDEX idx_rounds_user ON rounds(user_id);
CREATE INDEX idx_rounds_course ON rounds(course_id);
CREATE INDEX idx_scores_round ON scores(round_id);
CREATE INDEX idx_pace_events_course_date ON pace_events(course_id, created_at);
CREATE INDEX idx_groups_course_date ON groups(course_id, date);
CREATE INDEX idx_tee_times_course_date ON tee_times(course_id, scheduled_at);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

---

## Deployment Environments

### Development / Testing (MVP)

| Service | Platform | What deploys there | Cost |
|---------|----------|-------------------|------|
| **Frontends** | Vercel | Dashboard + Golfer PWA (Vite builds) | Free tier |
| **API** | Koyeb | Fastify + Socket.io (persistent process) | Free tier (1 web service) |
| **Database** | Neon | PostgreSQL 16 + PostGIS | Free tier (0.5 GB) |

- Vercel frontends connect to Koyeb API URL via `VITE_API_URL` env var
- Koyeb API connects to Neon via `DATABASE_URL` env var (use Neon's connection pooling endpoint)
- Socket.io works natively on Koyeb (persistent containers)
- Neon supports PostGIS: `CREATE EXTENSION postgis;`
- Neon database branching useful for dev/staging isolation
- **Caveat:** Koyeb free tier has cold starts — first WebSocket connection after idle may be slow

### Production (post-MVP)

| Service | Platform | Notes |
|---------|----------|-------|
| **Everything** | Hetzner VPS + Docker Compose | GDPR-compliant (EU), predictable cost, full control |
| **Database** | PostgreSQL on same VPS (or Hetzner managed) | |
| **Reverse proxy** | Nginx + Let's Encrypt SSL | HTTPS termination, WebSocket upgrade |

> Zero code changes between environments — only environment variables differ.

---

## Sprint Breakdown

### Sprint 1 — Foundation & Infra

**Goal:** Monorepo scaffold, database running, schema migrated, basic Fastify skeleton with security foundations. No business logic yet.

| # | Task | Description |
|---|------|-------------|
| 1.1 | Initialize monorepo | pnpm workspace, tsconfig.base.json, shared ESLint+Prettier config, .gitignore, .nvmrc |
| 1.2 | Docker dev environment | docker-compose.yml with PostgreSQL 16 + PostGIS 3.4, Adminer for debugging |
| 1.3 | HTTPS local dev | mkcert for local certs + Vite `--https` config. Required for Geolocation API in browsers |
| 1.4 | Drizzle schema — core tables | `users` (with CHECK constraint), `courses`, `holes`, `hazards`, `course_roles` with PostGIS geometry types |
| 1.5 | Drizzle schema — tracking tables | `tee_times`, `groups`, `sessions`, `positions` (partitioned), `rounds`, `scores`, `pace_events`, `refresh_tokens` (with `revoked_at`) |
| 1.6 | Generate & run initial migration | `drizzle-kit generate` + `drizzle-kit migrate`. Verify PostGIS extensions, spatial indexes, partition creation, CHECK constraints |
| 1.7 | Seed data — test course | Realistic 18-hole test course with geofences, hazards, sample tee times. Use pilot course data or synthetic |
| 1.8 | Fastify API skeleton | App setup with `/api/v1/` prefix, CORS, Helmet, `@fastify/rate-limit`, JSON Schema validation, error handler, health check |
| 1.9 | CI pipeline | GitHub Actions workflow: lint + typecheck + test on every PR. Fail-fast |

**Deliverable:** Monorepo builds, database runs with full schema, Fastify starts with security basics, CI green.

---

### Sprint 1b — Simulation Tooling

**Goal:** Build a golf course simulator that generates realistic GPS traces for testing the full pipeline (position ingestion → pace engine → dashboard). Two modes: CLI tool for E2E testing, API dev mode for quick dashboard prototyping.

> **Design doc:** `docs/plans/simulator-design.md` — covers scenarios, time acceleration, GPS path generation, file structure.

| # | Task | Description |
|---|------|-------------|
| 1b.1 | CLI simulator tool | `tools/simulator/`: Commander.js CLI with dry-run and live modes. SimClock for time acceleration, Bezier GPS path generator, 4 pre-built scenarios (happy-path, slow-group, bottleneck, gap-compression) + random procedural generator. Socket.io + REST clients for live mode. 37 unit tests. |
| 1b.2 | API dev mode plugin | `apps/api/src/simulation/`: Fastify plugin registered when `DEV_SIMULATE=true`. Internal engine feeds positions directly to PositionBuffer (bypasses auth/Socket.io). REST endpoints for status/stop. |

**Deliverable:** `pnpm simulate -- --scenario happy-path --speed 30 --dry-run` works. API dev mode starts with `DEV_SIMULATE=true pnpm dev:api`. PositionBuffer integration pending Sprint 2.9.

---

### Sprint 2 — API, Auth & Real-time

**Goal:** Complete backend: authentication, spatial queries, WebSocket position ingestion, GPX import. No frontend.

| # | Task | Description |
|---|------|-------------|
| 2.1 | Auth — register + login | POST `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/anonymous`. JWT HS256, access (15 min) + refresh (7d). Rate limit: 10 req/min on auth endpoints. Validate `device_id` format on anonymous registration |
| 2.2 | Auth — middleware + refresh + logout | `verifyToken` middleware, `requireRole` guard, POST `/api/v1/auth/refresh` (check `revoked_at`), POST `/api/v1/auth/logout` (set `revoked_at` on refresh token) |
| 2.3 | Course endpoints | POST `/api/v1/courses/locate` (ST_Within boundary check), GET `/api/v1/courses/:slug/data` (full geodata response with `data_version`) |
| 2.4 | Session endpoints | POST `/api/v1/sessions/start`, PATCH `/api/v1/sessions/:id/finish`. Session lifecycle management |
| 2.5 | Scoring endpoints | POST `/api/v1/rounds`, PUT `/api/v1/rounds/:id/scores`, GET `/api/v1/users/me/rounds` |
| 2.6 | Spatial query service | Reusable service: `isOnCourse()`, `detectHole()`, `distanceToGreen()` wrapping PostGIS queries |
| 2.7 | Socket.io server | Initialize Socket.io on Fastify, JWT auth for WS connections, WS token refresh mechanism (see Key Technical Notes), room management |
| 2.8 | Position ingestion via WS | `position:update` event handler: validate, buffer (PositionBuffer interface), detect hole, store |
| 2.9 | PositionBuffer — in-memory | `InMemoryPositionBuffer` implementation: Map buffer, flush to PostgreSQL every 2s via bulk INSERT |
| 2.10 | Position batch endpoint | POST `/api/v1/positions/batch` for offline replay. Accepts array of positions with `recorded_at` timestamps. Deduplicate by `(session_id, recorded_at)` |
| 2.11 | GPX import CLI | `tools/import-course/`: parse GPX waypoints by naming convention, generate geofences (convex hull + buffer), insert into DB |
| 2.12 | Integration tests — auth | Vitest tests: register, login, logout, anonymous, refresh, token revocation, role guard, rate limiting |
| 2.13 | Integration tests — spatial | Vitest tests: course locate, hole detection, distance calculation with real PostGIS queries |

**Deliverable:** API accepts GPS positions via WebSocket, detects course/hole via PostGIS, stores in partitioned positions table. Auth works with rate limiting. GPX import tool works.

---

### Sprint 3 — Golfer PWA

**Goal:** Working PWA with GPS distances, scoring, offline resilience, and GDPR-compliant tracking consent.

| # | Task | Description |
|---|------|-------------|
| 3.1 | Scaffold golfer-app | React + Vite + vite-plugin-pwa. Service worker, manifest.json, offline shell |
| 3.2 | GDPR consent flow | GPS tracking consent prompt on first use. Store `gdpr_consent_at`. Withdrawal mechanism. Block tracking without consent |
| 3.3 | Auth screens | Optional register/login for scorecard persistence. Anonymous mode works without auth |
| 3.4 | Geolocation gate | On app open: request GPS → call `/api/v1/courses/locate` → if on course, load course data. Otherwise show "Vous n'êtes pas sur un parcours" |
| 3.5 | Course data caching | Download full course geodata once, cache in IndexedDB. Invalidate when `data_version` changes |
| 3.6 | GPS distance screen (P0) | Live distances to front/center/back of green + hazards. Client-side Haversine from cached data. Auto-refresh on position change |
| 3.7 | Auto hole detection (client) | Use cached geofences to detect current hole client-side (faster than server roundtrip). Fallback to server detection |
| 3.8 | Scorecard screen (P0) | Per-hole entry: strokes (tap +/-), putts, FIR/GIR toggles. Running total. Auto-advance to next hole |
| 3.9 | WebSocket client | Socket.io client: connect on session start, send `position:update` every 5s, handle reconnection + token refresh, receive `hole:detected` and `pace:reminder` |
| 3.10 | Offline position queue | Buffer positions in IndexedDB when offline or WS disconnected. Replay on reconnect. See Key Technical Notes |
| 3.11 | Background GPS (PWA) | `navigator.geolocation.watchPosition` with high accuracy. Android: works in background. iOS: foreground only (acceptable for MVP) |
| 3.12 | Session flow | "Démarrer le parcours" → create session via REST → start WS + GPS tracking. "Terminer" → end session, show summary |
| 3.13 | Round summary screen (P0) | Total score, per-hole breakdown, basic stats (total putts, FIR%, GIR%). Option to save (if registered) |
| 3.14 | PWA install prompt | A2HS (Add to Home Screen) flow with `beforeinstallprompt` event. Critical for PWA adoption |
| 3.15 | Notification preferences | Opt-out toggle for pace reminders. Stored in `notification_prefs` JSONB. Checked server-side before sending |
| 3.16 | UI polish + French copy | All labels, messages, notifications in French. Responsive mobile-first design |
| 3.17 | PWA testing on devices | Test on real Android + iOS devices at pilot course. Verify GPS accuracy, background behavior, battery impact, offline queue |

**Deliverable:** Golfer walks course with live GPS distances, enters scores, positions tracked and sent to server. Works through signal loss. GDPR consent enforced.

---

### Sprint 4 — Pace Engine

**Goal:** Dedicated sprint for the hardest algorithmic component. Group detection, pace calculation, alerting. No UI yet.

> **Design doc:** `docs/plans/pace-engine-design.md` — covers group lifecycle state machine, detection algorithm, hysteresis thresholds, bottleneck root-cause tracing, alert escalation/cooldown, projected finish formula, and all edge cases. **Read before implementing.**

| # | Task | Description |
|---|------|-------------|
| 4.1 | Tee time CRUD endpoints | POST/GET/PUT/DELETE `/api/v1/courses/:id/tee-times`. Required input for tee-time-based group detection. Optional — engine also works without tee times |
| 4.2 | Group detection | Auto-assign sessions to groups. **With tee times:** match by ±10 min proximity + Hole 1 co-location (±10 because tee sheets are often inaccurate). **Without tee times:** cluster by Hole 1 co-location within ±3 min. Handle solo players as single-person groups |
| 4.3 | Elapsed pace calculation | Per-group cumulative time vs. hole-specific pace targets. Derive per-hole targets from par (par-3: ~10 min, par-4: ~14 min, par-5: ~18 min) or use course overrides. Status: On Pace / Attention / Behind / Ahead |
| 4.4 | Gap time calculation | Time/distance gap between consecutive groups. Alert on compression (<5 min gap) or excessive lag (>15 min gap) |
| 4.5 | Bottleneck detection | Detect 2+ groups in same hole geofence for >3 min. Differentiate par-3 wait (expected, lower severity) from par-4/5 blockage (higher severity). Identify blocking group |
| 4.6 | Alert rules engine | Configurable thresholds per course. Generate `pace_events`. Emit Socket.io events to `course:${id}:dashboard` room |
| 4.7 | Pace engine integration tests | Test scenarios: normal round, slow group, bottleneck, walk-on group, solo player, group split. Use time-controllable test harness |

**Deliverable:** Pace engine detects groups, tracks pace in real-time, generates alerts. Fully tested against edge cases.

---

### Sprint 5 — Dashboard & Notifications

**Goal:** Manager dashboard with live course view, alerts, and push notifications to golfers.

| # | Task | Description |
|---|------|-------------|
| 5.1 | Shared UI package | Extract shared React hooks (`useAuth`, `useApi`, `useSocket`) and typed API client into `packages/ui/`. Both apps consume |
| 5.2 | Scaffold dashboard app | React + Vite. Manager login. Protected routes with role check (admin/marshal/owner) |
| 5.3 | Live course map | Mapbox GL JS: course boundary, hole outlines, real-time group markers color-coded by pace status |
| 5.4 | Group list panel | Sortable table: group #, tee time, current hole, elapsed time, pace status, projected finish time |
| 5.5 | Alert feed panel | Chronological alert list: pace alerts, bottlenecks, interventions. Filterable by type/priority |
| 5.6 | Dashboard WebSocket | Subscribe to `course:${id}:dashboard` room. Receive `groups:update`, `alert:pace`, `alert:bottleneck` |
| 5.7 | Server → Dashboard aggregation | Aggregate group positions every 5s, compute pace metrics, emit to dashboard room. Only aggregated data, not raw positions |
| 5.8 | Send reminder flow | Manager clicks "Envoyer un rappel" → REST call → push to group's devices. Pre-templated French messages. Check `notification_prefs` before sending |
| 5.9 | FCM integration | Firebase Cloud Messaging setup. Push token registration in golfer app. Server-side push sending |
| 5.10 | Web Push for managers | VAPID setup. Dashboard subscribes to browser notifications for high-priority alerts when tab not focused |
| 5.11 | Daily report endpoint + view | GET `/api/v1/courses/:id/reports/daily/:date`: rounds played, avg pace, bottleneck holes, interventions. Dashboard page with charts |

**Deliverable:** Full loop working: golfer tracking → pace engine → dashboard alerts → push notification to golfer.

---

### Sprint 6 — Analytics, Polish & Deploy

**Goal:** Historical analytics, deployment to Vercel + Koyeb + Neon, security audit, monitoring.

| # | Task | Description |
|---|------|-------------|
| 6.1 | Manager CRUD endpoints | Course settings (pace targets, tee intervals), user role management |
| 6.2 | Analytics — pace trends | Pace by day/week/month charts. Trend lines showing improvement |
| 6.3 | Analytics — bottleneck heatmap | Course map overlay showing bottleneck frequency by hole |
| 6.4 | Analytics — round distributions | Histograms: round duration, scores, pace distribution. Date range comparison |
| 6.5 | Tee interval optimizer | Analyze historical data → recommend optimal tee interval spacing |
| 6.6 | Manager analytics endpoints | GET `/api/v1/courses/:id/analytics` with date range filters, aggregation options |
| 6.7 | Security audit | Input validation audit (all Zod schemas reviewed), CORS lockdown to production domains, Helmet headers review, rate limit tuning (100 req/min general, 20/sec positions) |
| 6.8 | GDPR — data export + deletion | GET `/api/v1/users/me/export` (JSON dump), DELETE `/api/v1/users/me` (cascade delete + anonymize positions) |
| 6.9 | Position data retention | Automated job via node-cron: aggregate positions older than 12 months into summary stats, delete raw data. Auto-create next month's partition |
| 6.10 | Monitoring & logging | Structured JSON logging (pino). Error tracking (Sentry or similar). Uptime monitoring for API health endpoint |
| 6.11 | Neon database setup | Create Neon project, enable PostGIS, run migrations, seed pilot course data. Use pooled connection string |
| 6.12 | Koyeb API deployment | Deploy Fastify to Koyeb. Configure env vars (DATABASE_URL, JWT_SECRET, CORS origins, VAPID keys). Verify WebSocket connectivity |
| 6.13 | Vercel frontend deployments | Deploy dashboard + golfer-app. Configure VITE_API_URL → Koyeb. Set up preview deploys for PRs |
| 6.14 | Load testing | Simulate 50 concurrent GPS sessions. Verify position throughput, WebSocket stability, Neon connection pool, partition performance |
| 6.15 | Pilot preparation | Final test at partner course with real GPS mapping data. End-to-end walkthrough: golfer + manager simultaneously |

**Deliverable:** MVP deployed on Vercel + Koyeb + Neon. Monitoring active. Ready for real-world pilot testing.

> **Post-MVP:** Migrate to Hetzner VPS + Docker Compose for production (GDPR compliance, cost optimization, full control).

---

## Post-MVP Backlog

### Technical Debt / Upgrades
- [ ] **Hetzner migration**: Vercel+Koyeb+Neon → Hetzner VPS + Docker Compose (GDPR, cost)
- [ ] **JWT → RS256**: HS256 → RS256 for cross-service token verification
- [ ] **argon2id**: Replace bcrypt with argon2id (OWASP recommendation)
- [ ] **Redis PositionBuffer**: Swap in-memory buffer for Redis when horizontal scaling needed
- [ ] **Capacitor wrapper**: Native iOS/Android app for reliable background GPS
- [ ] **i18n (FR → EN, DE, ES)**: Internationalization framework
- [ ] **TimescaleDB**: Evaluate for positions table at high scale
- [ ] **Multi-tenant architecture**: Isolate course data for SaaS model
- [ ] **Course management UI**: Web-based course creation/editing (geofence editor, hole placement)

### Pace Engine Enhancements
- [ ] **Shotgun start support**: Groups start on different holes simultaneously. Adjust group detection + pace calculation to wrap hole sequence
- [ ] **Cart vs walking targets**: Per-group transport mode with ~15-20% shorter targets for carts. Auto-detect from GPS transition speed
- [ ] **Late joiner auto-merge**: Proximity-based group merge — if a solo session stays within 50m of an existing group for >2 min, offer to merge
- [ ] **Weather delay clock pause**: Global pause/resume of all pace clocks when lightning horn sounds or weather delay called
- [ ] **Tournament pause/resume**: Explicit pause mechanism for scheduled breaks (e.g. lunch during tournament). Unbounded pause with manual resume
- [ ] **9-hole round support**: Detect "finished at 9" vs "abandoned". Separate pace targets for 9-hole rounds

### Feature Backlog
- Competition management (handicap-optimized tee times, digital scorecards)
- Lesson reservation planning
- Tee sheet integration (Golfmanager API priority — 300+ courses)
- Dynamic pricing / yield management
- Hole flyover / satellite map view
- Shot tracking (club selection, ball landing)
- WHS-compliant handicap index calculation
- Social features (leaderboards, share rounds)
- Full offline mode (complete round without connectivity, sync later)
- Multi-course portfolio view
- Marshal tablet companion app
- PDF report exports
- FFGolf / DGV federation integration
- App Store / Google Play publication
- White-label option
- ML pace prediction model

---

## Key Technical Notes

### PostGIS Spatial Queries (reference)
```sql
-- Is user on course?
SELECT id FROM courses
WHERE ST_Within(ST_SetSRID(ST_MakePoint($lng, $lat), 4326), boundary);

-- Which hole?
SELECT hole_number FROM holes
WHERE course_id = $1
AND ST_Within(ST_SetSRID(ST_MakePoint($lng, $lat), 4326), geofence);

-- Distance to green (meters)
SELECT ST_Distance(
  ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
  green_center::geography
) FROM holes WHERE id = $1;
```

### Position Batching Pattern
```typescript
interface PositionBuffer {
  add(position: PositionInput): void;
  flush(): Promise<number>; // returns rows inserted
  size(): number;
}
// MVP: InMemoryPositionBuffer (flush every 2s)
// Scale: RedisPositionBuffer (shared across instances)
```

### Offline Position Queue (client-side)
```typescript
// In IndexedDB: 'pending_positions' object store
// On position update:
//   1. Always write to IndexedDB
//   2. If WebSocket connected → send + delete from IDB on ack
//   3. If disconnected → accumulate in IDB
// On reconnect:
//   1. Read all pending positions from IDB (sorted by recorded_at)
//   2. Send batch to server via REST POST /api/v1/positions/batch
//   3. Delete from IDB on success
// Max queue size: 2000 positions (~2.7 hours at 5s interval)
```

### WebSocket Token Refresh
```
Access token (15 min) expires during 4+ hour round.
Strategy:
  1. Client sets a timer at (token_expiry - 60s)
  2. On timer: call POST /api/v1/auth/refresh via REST
  3. On success: emit 'auth:refresh' event on WS with new access token
  4. Server updates the socket's auth context
  5. On refresh failure: disconnect WS, prompt re-login
No interruption to position tracking during refresh.
```

### Rate Limiting Strategy
```
Auth endpoints:     10 req/min per IP (prevent brute force)
Anonymous register: 5 req/hour per IP (prevent account flooding)
General API:        100 req/min per user (normal usage)
Position ingest:    20 req/sec per session (WS, ~4x expected rate)
Course locate:      30 req/min per IP (prevent scanning)
```

### Pace Engine Thresholds
| Status | Condition |
|--------|-----------|
| Ahead | >3 min ahead of target |
| On Pace | Within ±3 min of target |
| Attention | +3 to +8 min behind |
| Behind | >+8 min behind |
| Gap Compression | <5 min gap to group ahead |
| Gap Lagging | >15 min gap to group ahead |
| Bottleneck (par 4-5) | 2+ groups same hole >3 min |
| Bottleneck (par 3) | 2+ groups same hole >5 min (waiting expected) |

### Per-Hole Pace Targets (default derivation)
| Hole Par | Default Target (min) | Notes |
|----------|---------------------|-------|
| Par 3 | 10 | Short hole, but waiting on tee common |
| Par 4 | 14 | Standard hole |
| Par 5 | 18 | Long hole |

> Course-specific overrides via `holes.pace_target_minutes`. Total should sum to `courses.pace_target_minutes`.

### Database Connection Pooling
```
Neon free tier: limited connections.
Use Neon's pooled connection string (PgBouncer endpoint):
  DATABASE_URL=postgresql://...@ep-xxx.us-east-2.aws.neon.tech:5432/golfix?pgbouncer=true
Drizzle ORM works with pooled connections out of the box.
```
