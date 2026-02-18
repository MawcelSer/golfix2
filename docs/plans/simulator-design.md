# Golf Course Simulator — Design & Usage

> Development tool that generates realistic GPS traces for testing the full Golfix pipeline: position ingestion, pace engine, dashboard.

## Two Operating Modes

### Mode 1: CLI Simulator (`tools/simulator/`)

Standalone process connecting to the API via Socket.io. Authenticates as simulated golfers, creates sessions via REST, emits `position:update` events with simulated timestamps.

**Tests the full E2E pipeline** including auth, WebSocket, rate limiting.

```bash
# Dry-run (no network, generates + logs waypoints)
pnpm simulate -- --scenario happy-path --speed 30 --dry-run --verbose

# Live (connects to running API)
pnpm simulate -- --scenario slow-group --speed 30

# Random scenario with reproducible seed
pnpm simulate -- --scenario random --speed 60 --groups 6 --seed 42

# List available scenarios
pnpm simulate -- list
```

**Requires:** Sprint 2 auth + position ingestion endpoints for live mode.

### Mode 2: API Dev Mode (`DEV_SIMULATE=true`)

Fastify plugin inside the API process. Feeds positions directly to PositionBuffer (bypasses Socket.io + auth). Start with environment variables:

```bash
DEV_SIMULATE=true DEV_SIM_SPEED=30 pnpm dev:api
DEV_SIMULATE=true DEV_SIM_SPEED=60 DEV_SIM_GROUPS=6 pnpm dev:api
```

**REST endpoints** (when simulation active):
- `GET /api/v1/simulation/status` — check if simulation is running
- `POST /api/v1/simulation/stop` — stop the simulation

**Requires:** PositionBuffer integration (Sprint 2, task 2.9). Until then, positions are logged but not stored.

---

## Time Acceleration

A `SimClock` translates real time to simulated time:

| Speed | 4h15 round plays in |
|-------|---------------------|
| 10x   | ~25.5 min           |
| 30x   | ~8.5 min            |
| 60x   | ~4.25 min           |
| 100x  | ~2.55 min           |

Positions carry `recordedAt` in simulated time. The pace engine's real 5s tick receives batches of accelerated positions. At 30x, ~30 simulated positions arrive per tick.

---

## Scenario System

### 4 Pre-built Scenarios

| Scenario | What it tests | Key trigger |
|----------|---------------|-------------|
| `happy-path` | Baseline — 4 groups, all on pace | No alerts should fire |
| `slow-group` | Group 2 at 1.35x + stuck on holes 5,7 | `behind_pace` alert at hole 6-7 |
| `bottleneck` | Group 1 blocks par-3 hole 2 for 8 extra min | `bottleneck` alert |
| `gap-compression` | Group 3 at 0.8x catches Group 2 at 1.25x | `gap_compression` at hole 5-6 |

### Random Mode

Procedurally generates groups with random pace factors (0.8–1.4), random stuck holes, random noise. Optional `--seed` flag for reproducibility.

### Scenario Data Structure

```typescript
interface ScenarioDefinition {
  name: string;
  description: string;
  groups: Array<{
    groupIndex: number;        // maps to tee time slot (8-min intervals)
    paceFactor: number;        // 1.0 = target pace, 1.3 = 30% slower
    holeNoise: number;         // seconds of gaussian noise per hole
    stuckHoles: Array<{ hole: number; extraMinutes: number; reason: string }>;
    dropOutAtHole?: number;    // simulates abandoned session
  }>;
}
```

All scenarios are validated via Zod at runtime.

---

## GPS Path Generation

For each hole, waypoints are generated from `teePosition` → `greenCenter`:

1. **Quadratic Bezier curve** with slight lateral offset (±20m control point)
2. **Waypoint count** = `ceil(holePlayTimeMs / 5000)` (one every 5s)
3. **GPS noise**: ±5-15m accuracy via Gaussian distribution
4. **Seeded PRNG** (mulberry32) for reproducibility with `--seed`
5. **Haversine math only** — no PostGIS needed in the tool

### Per-hole timing

| Par | Target time | Typical waypoints |
|-----|-------------|-------------------|
| 3   | 10 min      | 120               |
| 4   | 14 min      | 168               |
| 5   | 17 min      | 204               |

Play time is modified by: `targetTime × paceFactor + gaussianNoise + stuckTime`

---

## File Structure

```
tools/simulator/
├── src/
│   ├── index.ts              # CLI entry (Commander.js)
│   ├── engine.ts             # Orchestrates groups, clock, emissions
│   ├── sim-clock.ts          # Virtual time with speed factor
│   ├── path-generator.ts     # Bezier GPS path between tee and green
│   ├── auth-client.ts        # JWT auth via POST /api/v1/auth/anonymous
│   ├── socket-client.ts      # Socket.io client per group session
│   ├── session-manager.ts    # REST: create/finish sessions
│   ├── scenarios/
│   │   ├── index.ts
│   │   ├── happy-path.ts
│   │   ├── slow-group.ts
│   │   ├── bottleneck.ts
│   │   ├── gap-compression.ts
│   │   └── random.ts         # Procedural generator
│   ├── types.ts              # Zod schemas + interfaces
│   ├── logger.ts             # Formatted CLI output (French)
│   └── __tests__/            # 37 unit tests
├── package.json
├── tsconfig.json
└── vitest.config.ts

apps/api/src/simulation/       # API dev mode
├── simulation-plugin.ts       # Fastify plugin (registered if DEV_SIMULATE=true)
├── internal-engine.ts         # Drives PositionBuffer directly
├── seed-coords.ts             # Static HOLES_DATA (mirrors seed.ts)
└── types.ts                   # PositionEvent interface
```

---

## Dependencies

`tools/simulator/package.json`:
- `socket.io-client@^4.8`, `commander@^12`, `chalk@^5`, `zod@^3.24`
- `@golfix/shared: workspace:*`

Root `package.json` script: `"simulate": "pnpm --filter @golfix/simulator simulate"`

---

## Testing

| Test suite | Count | What it covers |
|------------|-------|----------------|
| `sim-clock.test.ts` | 7 | Time advancement, speed math, formatting |
| `path-generator.test.ts` | 17 | Waypoints near tee/green, Haversine, deterministic RNG, accuracy bounds |
| `scenarios.test.ts` | 13 | All 4 scenarios pass Zod, random is deterministic + bounded |

Run: `cd tools/simulator && npx vitest run`

---

## Sprint Dependencies

| Component | Available from | Depends on |
|-----------|---------------|------------|
| Dry-run mode | Now (Sprint 1b) | Nothing |
| API dev mode (logging) | Now (Sprint 1b) | Nothing |
| API dev mode (PositionBuffer) | Sprint 2.9 | `InMemoryPositionBuffer` |
| CLI live mode | Sprint 2 | Auth endpoints (2.1) + Sessions (2.4) + Socket.io (2.7-2.8) |
| Pace engine testing | Sprint 4 | Pace engine (4.2-4.6) |
