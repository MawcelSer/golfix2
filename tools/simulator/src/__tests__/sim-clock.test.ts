import { describe, expect, it } from "vitest";

import { SimClock } from "../sim-clock";

describe("SimClock", () => {
  it("returns start time immediately after creation", () => {
    const start = new Date("2024-01-15T08:00:00Z");
    const clock = new SimClock(start, 30);

    const now = clock.now();
    // Should be very close to start time (within a few hundred ms of sim time)
    const diffMs = Math.abs(now.getTime() - start.getTime());
    expect(diffMs).toBeLessThan(5000); // within 5s sim time at 30x = ~167ms real
  });

  it("advances time at the configured speed factor", async () => {
    const start = new Date("2024-01-15T08:00:00Z");
    const clock = new SimClock(start, 100);

    // Wait 100ms real time → ~10s simulated at 100x
    await new Promise((r) => setTimeout(r, 100));

    const elapsed = clock.elapsedMs();
    expect(elapsed).toBeGreaterThan(5_000); // at least 5s sim
    expect(elapsed).toBeLessThan(20_000); // at most 20s sim (accounting for timing jitter)
  });

  it("calculates realMsFor correctly", () => {
    const clock = new SimClock(new Date(), 30);

    // 30 simulated seconds = 1 real second at 30x
    expect(clock.realMsFor(30_000)).toBeCloseTo(1_000, -1);

    // 4h15 = 255 min = 15300s → 510 real seconds at 30x
    expect(clock.realMsFor(255 * 60_000)).toBeCloseTo(510_000, -1);
  });

  it("calculates simMsFor correctly", () => {
    const clock = new SimClock(new Date(), 60);

    // 1 real second = 60 simulated seconds at 60x
    expect(clock.simMsFor(1_000)).toBe(60_000);
  });

  it("formats real elapsed time as MM:SS", () => {
    const clock = new SimClock(new Date(), 1);
    const formatted = clock.formatRealElapsed();
    expect(formatted).toMatch(/^\d{2}:\d{2}$/);
  });

  it("exposes speed factor", () => {
    const clock = new SimClock(new Date(), 42);
    expect(clock.speedFactor).toBe(42);
  });

  it("exposes sim start time", () => {
    const start = new Date("2024-01-15T08:00:00Z");
    const clock = new SimClock(start, 1);
    expect(clock.simStartTime).toEqual(start);
  });
});
