# Pace Engine — Design Document

> Algorithmic design for real-time pace-of-play tracking, group detection, alerting, and bottleneck analysis.

**Status:** Draft — Pending review
**Sprint:** 4 — Pace Engine
**Last updated:** 2026-02-18

---

## Table of Contents

1. [Overview](#1-overview)
2. [Group Lifecycle](#2-group-lifecycle)
3. [Group Detection Algorithm](#3-group-detection-algorithm)
4. [Pace Calculation](#4-pace-calculation)
5. [Gap Time](#5-gap-time)
6. [Bottleneck Detection](#6-bottleneck-detection)
7. [Alert System](#7-alert-system)
8. [Projected Finish Time](#8-projected-finish-time)
9. [Edge Cases](#9-edge-cases)
10. [Data Flow](#10-data-flow)
11. [Testing Strategy](#11-testing-strategy)
12. [Post-MVP: Shotgun Starts](#12-post-mvp-shotgun-starts)
13. [Post-MVP: Cart vs Walking](#13-post-mvp-cart-vs-walking)

---

## 1. Overview

### What the pace engine does

The pace engine is a server-side service that runs continuously while a course has active sessions. It:

1. **Detects groups** — clusters individual golfer sessions into groups
2. **Tracks pace** — calculates each group's elapsed time vs expected time
3. **Monitors gaps** — measures time/distance gaps between consecutive groups
4. **Detects bottlenecks** — identifies holes where groups are stacking up
5. **Generates alerts** — emits events to the dashboard with escalation and cooldown
6. **Projects finish times** — estimates when each group will complete their round

### Inputs

- Active sessions with GPS positions (via `PositionBuffer` flush, every 2s)
- Course geodata (hole geofences, tee positions, green positions)
- Tee times (optional — engine works without them)
- Per-hole pace targets (derived from par or overridden per course)
- Transition times between holes (configurable per course)

### Outputs

- `groups:update` — emitted to `course:${id}:dashboard` room every 5s
- `pace_events` — persisted to database, emitted to dashboard on creation
- `pace:reminder` — emitted to specific golfer sessions when manager sends a reminder

### Processing cadence

The engine evaluates on a **5-second tick**. Each tick:

1. Re-evaluate group membership
2. Update each group's current hole and pace status
3. Calculate gaps between consecutive groups
4. Check bottleneck conditions
5. Evaluate alert rules (with cooldown/escalation)
6. Emit `groups:update` to dashboard room

---

## 2. Group Lifecycle

### State Machine

```
                    ┌──────────────────────────┐
                    │                          │
    ┌───────┐    assign     ┌─────────┐    last session    ┌──────────┐
    │FORMING│───sessions───>│ PLAYING │────finishes───────>│ FINISHED │
    └───────┘               └─────────┘                    └──────────┘
                                │   ▲
                            in transition
                            zone (hole gap)
                                │   │
                            ┌───▼───┴──┐
                            │IN_TRANSIT │
                            └──────────┘
```

### States

| State | Description | Duration |
|-------|-------------|----------|
| **FORMING** | Group detected on Hole 1 tee area, waiting for all members. Pace clock not started. | Until first member leaves tee area, max 5 min |
| **PLAYING** | Group is actively playing a hole. Pace clock running. | While any member is inside a hole geofence |
| **IN_TRANSIT** | Group is between holes (walking from green to next tee). Pace clock running but transition time is accounted for. | Until first member enters next hole geofence |
| **FINISHED** | All sessions in group are finished or abandoned. | Terminal state |

### Key Rules

- A group's **pace clock starts** when it transitions from FORMING → PLAYING (first member moves beyond Hole 1 tee box area).
- **IN_TRANSIT is not a pause** — transition time is factored into the expected time per hole. The clock runs, but the engine doesn't flag a group as idle during transition.
- A group is **FINISHED** when all its sessions have `status = finished` or `status = abandoned`.
- If all sessions in a group become abandoned (no GPS data for >15 min), the group auto-finishes.

---

## 3. Group Detection Algorithm

### MVP: Sequential Tee Times

All groups start from Hole 1 in order. Detection uses two signals:

#### Signal 1: Tee Time Matching (when tee times exist)

```
For each new session that enters Hole 1 geofence:
  1. Find tee_times where |scheduled_at - session.started_at| < 10 min
  2. If a match exists:
     a. Find or create a group linked to that tee_time
     b. Assign session to the group
  3. If no match (walk-on):
     → Fall through to GPS co-location clustering
```

> **Why ±10 min, not ±5 min?** Tee sheets are often inaccurate. A group with a 14:00 tee time might not actually tee off until 14:08. The ±10 window catches late starters without being so wide that it merges different tee times (minimum tee interval is typically 7-8 min).

#### Signal 2: GPS Co-location Clustering (walk-ons or no tee times)

```
For each new session that enters Hole 1 geofence without a tee time match:
  1. Find FORMING groups on Hole 1 where:
     - Group does not yet have 4 members
     - Any group member is within 50m of the new session
     - Group has been FORMING for < 5 min
  2. If a match exists:
     → Assign session to the group
  3. If no match:
     → Create a new group, assign this session
     → Set group_number = next sequential number for today
```

#### Group Membership Re-evaluation

Run every 60 seconds for PLAYING groups:

```
For each group in PLAYING state:
  1. Check each session's last known position
  2. If a session has no GPS data for > 10 min:
     → Mark session as "lost contact" (don't remove from group yet)
  3. If a session has no GPS data for > 20 min:
     → Mark session as abandoned, remove from group
  4. If a session is > 2 holes behind the group median:
     → Flag as "separated" but keep in group
     → Use group median position for pace calculation (exclude outlier)
```

> **Why not remove separated players?** A player 2 holes behind might be searching for a lost ball or taking a bathroom break. Removing them and creating a new solo group creates noise. Better to flag and exclude from pace calculation while keeping them associated.

#### Group Completion Rules

- A group is considered "complete" (no more members expected) when:
  - It has reached the tee_time's `players_count`, OR
  - It has been in FORMING state for >5 min, OR
  - At least one member has moved beyond Hole 1 tee area
- Once complete, no new sessions are assigned to this group.

---

## 4. Pace Calculation

### Per-Hole Expected Time

Each hole has an expected completion time composed of two parts:

```
expected_time(hole) = play_time(hole) + transition_time(hole)
```

Where:
- `play_time` = time to play the hole itself (derived from par or overridden)
- `transition_time` = time to walk/ride from this hole's green to the next hole's tee

#### Default Play Times (walking)

| Par | Default Play Time (min) |
|-----|------------------------|
| 3 | 10 |
| 4 | 14 |
| 5 | 18 |

> Overridable per hole via `holes.pace_target_minutes`.

#### Transition Times

Stored as a course-level configuration in `courses` (JSONB column or separate table):

```json
{
  "transition_minutes": {
    "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1,
    "7": 3, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1,
    "13": 1, "14": 1, "15": 1, "16": 1, "17": 1, "18": 0
  }
}
```

> Pilot course: Hole 7→8 has a 3-minute walk. All others default to 1 minute. Hole 18 has 0 (round ends).

> **Schema change needed:** Add `transition_config JSONB` to `courses` table, or a `transition_minutes SMALLINT DEFAULT 1` column to `holes` table (transition time AFTER this hole). The per-hole column is simpler.

#### Cumulative Expected Time

```
expected_at_hole(n) = SUM(expected_time(hole_i)) for i = 1 to n
```

Example for a par-72 course (par sequence: 4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4):

```
Hole  1: 14+1 = 15 min → cumulative: 15
Hole  2: 10+1 = 11 min → cumulative: 26
Hole  3: 18+1 = 19 min → cumulative: 45
...
Hole  7: 14+3 = 17 min → cumulative: 113  (includes 3-min walk to Hole 8)
Hole  8: 18+1 = 19 min → cumulative: 132
...
Hole 18: 14+0 = 14 min → cumulative: ~255 min (4h15)
```

### Pace Status Calculation

```
elapsed = now - group.pace_start_time
expected = expected_at_hole(group.current_hole)
delta = elapsed - expected  (positive = behind, negative = ahead)
```

### Status Thresholds with Hysteresis

To prevent flickering between states, use asymmetric entry/exit thresholds:

| Status | Entry Condition | Exit Condition |
|--------|----------------|----------------|
| **Ahead** | delta < -3 min | delta > -2 min (then → On Pace) |
| **On Pace** | -3 min ≤ delta ≤ +3 min | (transitions to Ahead or Attention at their entry thresholds) |
| **Attention** | delta > +3 min | delta < +2 min (then → On Pace) |
| **Behind** | delta > +8 min | delta < +6 min (then → Attention) |

> **Hysteresis buffer = 1-2 min.** A group must improve by more than the noise margin to downgrade severity. This prevents a group oscillating at +7:55/+8:05 from generating repeated Behind/Attention transitions.

### Pace Clock Rules

| Event | Clock Behavior |
|-------|---------------|
| Group enters FORMING | Clock not started |
| First member leaves Hole 1 tee area | Clock starts (`pace_start_time` set) |
| Group in IN_TRANSIT between holes | Clock runs (transition time is in the expected time budget) |
| Weather delay (future) | Clock pauses globally for all groups |
| Session abandoned mid-round | Remaining members continue, clock unaffected |

---

## 5. Gap Time

### Definition

Gap time measures the spacing between consecutive groups on the course.

```
gap(group_A, group_B) = time_at_position(group_B) - time_at_position(group_A)
```

Where `group_A` is ahead of `group_B` (lower group number, earlier tee time).

### Measurement Method

Since groups are usually on different holes, we can't directly compare times. Instead:

```
For group_B (the group behind):
  1. Find group_B's current hole (call it hole_N)
  2. Find the timestamp when group_A was last detected at hole_N
     (from positions history or group state log)
  3. gap = group_B.arrival_at_hole_N - group_A.arrival_at_hole_N
```

> This is "same-hole gap time" — how far behind group B is at the same physical point on the course.

### Gap Tracking Data Structure

Maintain a `hole_arrivals` map per group:

```typescript
interface GroupState {
  id: string;
  sessions: string[];           // session IDs
  currentHole: number;
  paceStatus: PaceStatus;
  paceStartTime: Date;
  holeArrivals: Map<number, Date>;  // hole_number → first_arrival_time
  alertState: AlertState;
}
```

When a group's first member enters a new hole geofence, record the timestamp in `holeArrivals`.

### Gap Thresholds

| Condition | Threshold | Severity |
|-----------|-----------|----------|
| **Compression** | gap < 5 min | warning — group behind is catching up, potential wait |
| **Severe compression** | gap < 2 min | critical — groups are stacking, imminent bottleneck |
| **Normal** | 5 min ≤ gap ≤ 15 min | info — healthy spacing |
| **Lagging** | gap > 15 min | info — large gap, course has room. Not necessarily a problem |
| **No group ahead** | first group of the day | N/A — no gap to measure |

### Gap vs Pace Interaction

A group can be:
- **On Pace but compressed** — they're fast, but the group ahead is even faster. The gap is shrinking because everyone is fast. Low concern.
- **Behind and compressed** — the group ahead is slow, causing this group to wait. The group behind is a victim, not the cause. Alert should target the group ahead.
- **Behind and lagging** — the group is slow AND has a large gap ahead. They are definitively the slow group. Alert should target them.

> The engine should annotate gap alerts with **directionality**: is the gap shrinking because group B is fast, or because group A is slow?

---

## 6. Bottleneck Detection

### Definition

A bottleneck occurs when multiple groups occupy the same hole simultaneously, indicating that play has stacked up.

### Detection Algorithm

```
Every 5s tick:
  1. Build a hole_occupancy map: hole_number → [groups present]
  2. For each hole with 2+ groups:
     a. Calculate overlap_duration = min(time_any_group_has_been_on_this_hole)
     b. If overlap_duration > threshold:
        → Bottleneck detected at this hole
```

### Par-Adjusted Thresholds

| Hole Par | Bottleneck Threshold | Rationale |
|----------|---------------------|-----------|
| Par 3 | 2+ groups for >5 min | Waiting on par-3 tees is expected (short hole, groups bunch) |
| Par 4 | 2+ groups for >3 min | Less expected — indicates a slow group |
| Par 5 | 2+ groups for >3 min | Same as par 4 — long holes should not cause bunching |

### Root Cause Identification

When multiple consecutive holes show bottlenecks, identify the root cause:

```
If holes 5, 6, 7 all have bottlenecks:
  1. The root cause is the FOREMOST hole with a bottleneck (hole 5)
  2. The blocking group is the group that has been on hole 5 the longest
  3. Holes 6 and 7 are "cascading" bottlenecks (consequence, not cause)
```

Implementation:

```
For each bottleneck hole (sorted ascending by hole_number):
  1. Find the group that has been on this hole the longest (the "blocker")
  2. Check if the hole AHEAD (hole_number - 1) also has a bottleneck
     - If yes: this hole's bottleneck is a cascade, not the root
     - If no: this hole is the root cause
  3. Tag the blocker group and the root hole in the pace_event
```

### Bottleneck State

Track bottleneck state to avoid repeated alerts:

```typescript
interface BottleneckState {
  hole: number;
  startedAt: Date;
  blockerGroupId: string;
  isCascade: boolean;         // true = caused by upstream bottleneck
  rootHole: number | null;    // if cascade, which hole is the root
  alertEmitted: boolean;
  resolvedAt: Date | null;
}
```

A bottleneck is **resolved** when:
- Fewer than 2 groups occupy the hole, OR
- The overlap duration drops below threshold (blocker group moves on)

---

## 7. Alert System

### Alert Types

| Type | Trigger | Default Severity |
|------|---------|-----------------|
| `behind_pace` | Group enters Behind status | warning |
| `gap_compression` | Gap drops below 5 min | warning |
| `gap_severe` | Gap drops below 2 min | critical |
| `bottleneck` | 2+ groups on same hole beyond threshold | warning (par 4-5) or info (par 3) |
| `reminder_sent` | Manager sends pace reminder | info (logged) |

### Cooldown & Escalation

Each group maintains an alert state:

```typescript
interface AlertState {
  lastAlertType: string | null;
  lastAlertTime: Date | null;
  lastReminderTime: Date | null;   // when manager last sent a reminder
  escalationLevel: number;         // 0 = none, 1 = first alert, 2 = post-reminder, 3 = critical
}
```

#### Escalation Flow

```
1. Group enters "Behind" status
   → Emit behind_pace alert (severity: warning, escalation: 1)
   → Start cooldown: 15 min

2. Manager sends a reminder
   → Log reminder_sent event
   → Reset cooldown to 15 min from now
   → Set escalationLevel = 2

3. After 15 min cooldown expires:
   a. If group is still Behind:
      → Emit behind_pace alert (severity: critical, escalation: 3)
      → New cooldown: 20 min
   b. If group improved to Attention:
      → No alert, but keep monitoring
   c. If group improved to On Pace:
      → Clear alert state, log resolution

4. If group reaches On Pace at any point:
   → Clear alert state
   → Emit resolution event (info severity)
```

#### Cooldown Rules

| Scenario | Cooldown Duration |
|----------|------------------|
| First `behind_pace` alert | 15 min |
| After manager sends reminder | 15 min (reset) |
| Subsequent `behind_pace` alert (escalated) | 20 min |
| `gap_compression` alert | 10 min |
| `bottleneck` alert | 10 min |
| After `gap_severe` or critical bottleneck | 5 min (urgent, shorter cooldown) |

### Alert Payload

```typescript
interface PaceAlert {
  type: 'behind_pace' | 'gap_compression' | 'gap_severe' | 'bottleneck' | 'reminder_sent';
  severity: 'info' | 'warning' | 'critical';
  courseId: string;
  groupId: string;
  groupNumber: number;
  currentHole: number;
  details: {
    // behind_pace
    delta?: number;              // minutes behind target
    escalationLevel?: number;

    // gap_compression / gap_severe
    gapMinutes?: number;         // current gap to group ahead
    groupAheadId?: string;

    // bottleneck
    blockerGroupId?: string;     // which group is causing it
    isCascade?: boolean;
    rootHole?: number;
    overlapMinutes?: number;
  };
  timestamp: Date;
}
```

---

## 8. Projected Finish Time

### Formula

```
projected_finish = now + remaining_expected_time × pace_factor

Where:
  remaining_expected_time = SUM(expected_time(hole_i)) for i = (current_hole + 1) to 18
  pace_factor = elapsed / expected_at_hole(current_hole)
```

### Example

Group on Hole 10, 2h30 elapsed, expected at Hole 10 = 2h15:

```
pace_factor = 150 / 135 = 1.11 (playing 11% slower than target)
remaining_expected = sum of holes 11-18 expected times = 120 min
projected_remaining = 120 × 1.11 = 133 min
projected_finish = now + 133 min
```

### Edge Cases

- **Pace factor < 0.7** (extremely fast): Cap at 0.7 to avoid unrealistically early projections.
- **Pace factor > 1.5** (extremely slow): Cap at 1.5. Beyond this, the projection is unreliable.
- **Group on Hole 1**: Not enough data — show "Estimating..." instead of a number.
- **Group on Hole 2-3**: Use pace factor but display with lower confidence indicator.

### Smoothing

Use exponentially weighted moving average (EWMA) for pace_factor to avoid jitter:

```
pace_factor_smoothed = α × pace_factor_current + (1 - α) × pace_factor_previous
α = 0.3 (weight toward recent data, but dampens single-hole outliers)
```

This prevents a single slow hole (lost ball) from dramatically shifting the projection.

---

## 9. Edge Cases

### 9.1 Walk-on Groups (No Tee Time)

**Handling:** GPS co-location clustering on Hole 1 (see Section 3, Signal 2).

**Risk:** Two unrelated walk-ons arrive at Hole 1 within 3 minutes and get grouped together.

**Mitigation:** Require spatial proximity (50m) in addition to temporal proximity. Two strangers on opposite sides of the tee area won't be grouped.

### 9.2 Solo Players

**Handling:** A solo player who doesn't match any group is assigned to their own single-person group.

**Pace targets apply normally.** Solo players are often faster, so they'll likely show as "Ahead" or "On Pace."

**Gap calculation:** Solo groups participate in gap calculation like any other group. A solo player catching up to a 4-ball ahead is a valid compression alert.

### 9.3 Late Arrival to a Group

**Scenario:** 3 players start on Hole 1 at 14:00. The 4th arrives at 14:12 and joins on Hole 2.

**Handling:** The 4th player's session won't match the group via Hole 1 co-location (they missed it). Options:

1. **Manual assignment** — Manager assigns via dashboard (post-MVP feature).
2. **Proximity re-evaluation** — During the 60-second membership check, if a solo session is consistently within 50m of an existing group for >2 consecutive checks (2 min), offer to merge them.
3. **MVP: treat as solo group.** The 4th player gets their own group. Not ideal but acceptable for MVP.

> **MVP decision:** Option 3 (solo group). Add proximity-based auto-merge in a later sprint.

### 9.4 Player Leaves Mid-Round

**Scenario:** A 4-ball becomes a 3-ball at Hole 12 (injury, phone call, etc.).

**Handling:** When a session's status changes to `finished` or `abandoned`:
- Remove from group's active session list.
- If group still has ≥1 active session, continue tracking.
- If group has 0 active sessions, set group to FINISHED.
- Pace calculation continues with remaining members.

### 9.5 Lost GPS Signal

**Scenario:** A golfer enters a dead zone (tree cover, valley) for 5-10 minutes.

**Handling:**
- Position ingestion stops, but session stays active.
- Group continues tracking based on other members' positions.
- If ALL members lose signal simultaneously: group's current hole and pace status freeze.
- After 10 min with no data from a session: flag as "lost contact" (see Section 3).
- After 20 min: mark as abandoned.

### 9.6 Hole 7→8 Transition (Pilot Course)

**Scenario:** 3-minute walk between Hole 7 and Hole 8 at the pilot course.

**Handling:** This is covered by `transition_minutes` configuration. Hole 7's transition time is set to 3 minutes. The expected time budget for reaching Hole 8 includes this walk:

```
expected_at_hole(8) = expected_at_hole(7) + play_time(8) + transition_time(7=3min)
```

No special logic needed — the transition time system generalizes to any course layout.

### 9.7 Generic Turn / Clubhouse Stop (Future Courses)

**Scenario:** Course where groups stop at the clubhouse between Hole 9 and Hole 10 for 10-20 minutes.

**Handling via transition time:** Set `transition_minutes` for Hole 9 to 15 (or whatever the typical stop duration is). This bakes the expected pause into the time budget.

**Why not a special "pause" state?** Because:
- A transition time of 15 min naturally handles the expected pause.
- If a group takes 20 min (5 min over), they'd show +5 min behind — which is correct, they took longer than expected.
- No special clock-pausing logic needed.

> **If a course needs a true unbounded pause** (e.g., lunch break during a tournament), that's a post-MVP feature requiring an explicit pause/resume mechanism.

### 9.8 Abandoned Session Detection

**Trigger:** No GPS data received for a session for >20 min.

**Action:**
1. Mark session `status = abandoned`.
2. Remove from group's active sessions.
3. If no active sessions remain in group → mark group FINISHED.
4. Log a `session_abandoned` event (not a pace_event, just an operational log).

### 9.9 Course with No Tee Times

**Handling:** Entirely GPS co-location based clustering (Section 3, Signal 2). Works the same — just no tee_time matching step.

### 9.10 Simultaneous Session Start (Race Condition)

**Scenario:** Two sessions enter Hole 1 geofence within the same 5-second tick.

**Handling:** Both are processed in the same tick. The clustering algorithm runs on all unassigned sessions in Hole 1 simultaneously. They'll either:
- Match the same tee_time → assigned to the same group.
- Be within 50m of each other → assigned to the same group.
- Be far apart → assigned to different groups.

No race condition because the engine processes in batches, not per-event.

---

## 10. Data Flow

### Runtime Architecture

```
                     Position ingestion (every 2s flush)
                              │
                              ▼
┌─────────────────────────────────────────────────────┐
│                    PACE ENGINE                       │
│                                                      │
│  ┌───────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  Group     │    │  Pace        │    │  Alert    │ │
│  │  Detector  │───>│  Calculator  │───>│  Engine   │ │
│  └───────────┘    └──────────────┘    └───────────┘ │
│       │                │                    │        │
│       │           ┌────▼─────┐              │        │
│       │           │  Gap &   │              │        │
│       │           │Bottleneck│──────────────│        │
│       │           │ Detector │              │        │
│       │           └──────────┘              │        │
│       │                                     │        │
│       ▼                                     ▼        │
│  ┌─────────┐                         ┌───────────┐  │
│  │ groups   │                         │pace_events│  │
│  │ table    │                         │  table    │  │
│  └─────────┘                         └───────────┘  │
│                                                      │
│  Every 5s: emit groups:update ──────────────────────>│── Socket.io
│  On alert: emit alert:pace / alert:bottleneck ──────>│   dashboard room
└─────────────────────────────────────────────────────┘
```

### In-Memory State

The pace engine maintains state in memory (not in database) for performance:

```typescript
interface PaceEngineState {
  courseId: string;
  groups: Map<string, GroupState>;       // groupId → state
  bottlenecks: Map<number, BottleneckState>;  // hole → state
  lastTick: Date;
}

interface GroupState {
  id: string;
  groupNumber: number;
  teeTimeId: string | null;
  sessions: string[];                    // active session IDs
  state: 'FORMING' | 'PLAYING' | 'IN_TRANSIT' | 'FINISHED';
  currentHole: number;
  paceStartTime: Date | null;
  paceStatus: 'ahead' | 'on_pace' | 'attention' | 'behind';
  paceFactor: number;                    // EWMA smoothed
  holeArrivals: Map<number, Date>;       // hole_number → arrival_time
  alertState: AlertState;
}
```

### Persistence

- **Groups table** — updated on state transitions (FORMING→PLAYING, status change, FINISHED).
- **Pace events** — INSERT on alert creation and resolution.
- **Sessions** — UPDATE `current_hole` and `group_id` on detection.

> **Crash recovery:** If the server restarts, rebuild `PaceEngineState` from database: load active groups, their sessions, and recent positions to reconstruct `holeArrivals`. The EWMA pace factor resets (acceptable — it converges within 2-3 holes).

---

## 11. Testing Strategy

### Test Harness

Use a **time-controllable test harness** that:
- Accepts a sequence of `(session_id, position, timestamp)` events
- Advances the engine tick-by-tick with controlled time
- Asserts on group state, pace status, alerts emitted

```typescript
interface PaceEngineTestHarness {
  setCourseData(course: Course, holes: Hole[]): void;
  setTeeTime(teeTime: TeeTime): void;
  addSession(sessionId: string, startedAt: Date): void;
  emitPosition(sessionId: string, lat: number, lng: number, at: Date): void;
  tick(at: Date): TickResult;  // advance engine to this time
}

interface TickResult {
  groups: GroupState[];
  alerts: PaceAlert[];
  bottlenecks: BottleneckState[];
}
```

### Test Scenarios

| # | Scenario | Validates |
|---|----------|-----------|
| 1 | **Normal round** — 4 groups, 8-min intervals, all on pace | Baseline: no alerts emitted, projections accurate |
| 2 | **Slow group** — Group 2 is 10 min behind by Hole 6 | `behind_pace` alert at correct time, hysteresis prevents flickering |
| 3 | **Gap compression** — Group 3 catches Group 2 | `gap_compression` alert, correct directionality |
| 4 | **Bottleneck (par 4)** — Groups 2+3 on Hole 7 for >3 min | Bottleneck detected, blocker identified |
| 5 | **Bottleneck (par 3)** — Groups on par-3 for 4 min | No bottleneck (threshold is 5 min for par 3) |
| 6 | **Cascading bottleneck** — Holes 5,6,7 all blocked | Root cause = Hole 5, others tagged as cascade |
| 7 | **Walk-on group** — No tee time, 3 players cluster on Hole 1 | Group created via GPS co-location |
| 8 | **Solo player** — One player, no group match | Solo group created, pace tracked normally |
| 9 | **Player abandons** — Session abandoned at Hole 12 | Removed from group, group continues |
| 10 | **Reminder + escalation** — Manager sends reminder, group still slow | Cooldown period, then escalated alert |
| 11 | **Recovery** — Slow group catches up | Alert resolved, resolution event emitted |
| 12 | **Long transition** — Hole 7→8 with 3-min walk | No false pace alert during transition |
| 13 | **Lost GPS** — All members lose signal for 8 min | Group state freezes, no false alerts, recovers on signal return |
| 14 | **Projected finish accuracy** — Compare projection at Hole 9 with actual finish | Projection within ±10 min of actual |

### Performance Test

Simulate a full day:
- 50 groups, 4 players each = 200 sessions
- 5-second ticks for 5 hours = 3,600 ticks
- Verify engine processes each tick in <50ms

---

## 12. Post-MVP: Shotgun Starts

In a shotgun start, all groups start simultaneously on different holes.

**Key differences from sequential:**
- Group detection: assigned by tee sheet (group N → Hole N), no GPS clustering needed.
- Pace calculation: each group's "Hole 1" is their starting hole. Cumulative expected time wraps around (e.g., start at Hole 10, play 10→18, then 1→9).
- Gap time: groups on adjacent holes start at the same time, so initial gap = 0. Gap becomes meaningful only after groups start diverging.
- Bottleneck detection: same logic, but all holes can bottleneck simultaneously at the start.

> **Implementation:** Add a `start_type` field to groups or course config (`sequential` | `shotgun`). The pace calculator adjusts its hole sequence based on start type.

---

## 13. Post-MVP: Cart vs Walking

Different pace targets for cart and walking groups.

**Approach:**
- Add `transport_mode` to sessions or groups: `walking` | `cart` | `unknown`.
- Define per-hole play times for each mode (cart targets ~15-20% shorter).
- Manager can set transport mode when creating tee times, or engine can auto-detect (cart GPS patterns are faster between holes — transition times < 1 min).

**Impact on alerts:**
- A walking group's pace is evaluated against walking targets.
- Gap time between a walking group and a cart group ahead needs careful handling — the cart group is naturally faster, so compression is expected on some holes.

---

## Appendix: Schema Additions

The following changes to PLAN.md's database schema are needed for this design:

### `holes` table — add column
```
transition_minutes SMALLINT DEFAULT 1  -- walk time from this hole's green to next tee
```

### `courses` table — no changes needed
`pace_target_minutes` already exists. Per-hole targets derive from `holes.par` or `holes.pace_target_minutes`.

### `groups` table — add column
```
pace_start_time TIMESTAMPTZ, nullable  -- when pace clock started (first tee shot)
```

### `pace_events` table — already sufficient
The `details JSONB` column handles all alert-specific data (escalation level, gap minutes, blocker group, cascade info, etc.)
