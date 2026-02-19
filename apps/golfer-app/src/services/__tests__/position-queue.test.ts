import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PositionUpdate } from "@golfix/shared";

const mockStore = new Map<string, unknown>();
const mockGet = vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? undefined));
const mockSet = vi.fn((key: string, val: unknown) => {
  mockStore.set(key, val);
  return Promise.resolve();
});
const mockDel = vi.fn((key: string) => {
  mockStore.delete(key);
  return Promise.resolve();
});

vi.mock("idb-keyval", () => ({
  get: (...args: unknown[]) => mockGet(...(args as [string])),
  set: (...args: unknown[]) => mockSet(...(args as [string, unknown])),
  del: (...args: unknown[]) => mockDel(...(args as [string])),
  createStore: vi.fn(() => ({})),
}));

const { enqueuePosition, drainAll, removeN, queueSize, clearQueue } =
  await import("../position-queue");

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
    mockStore.clear();
    vi.clearAllMocks();
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

  it("enqueues multiple positions sequentially", async () => {
    for (let i = 0; i < 5; i++) {
      await enqueuePosition(makePosition(i));
    }
    expect(await queueSize()).toBe(5);
  });

  it("removeN removes only first N entries", async () => {
    for (let i = 0; i < 5; i++) {
      await enqueuePosition(makePosition(i));
    }
    await removeN(3);
    expect(await queueSize()).toBe(2);

    const remaining = await drainAll();
    expect(remaining[0]?.lat).toBeCloseTo(48.8 + 3 * 0.001);
  });

  it("removeN clears all when count >= queue length", async () => {
    await enqueuePosition(makePosition(1));
    await enqueuePosition(makePosition(2));
    await removeN(5);
    expect(await queueSize()).toBe(0);
  });

  it("returns empty array and does not throw on IndexedDB error", async () => {
    mockGet.mockRejectedValueOnce(new Error("QuotaExceededError"));
    const result = await drainAll();
    expect(result).toEqual([]);
  });

  it("enqueue does not throw on IndexedDB error", async () => {
    mockGet.mockRejectedValueOnce(new Error("QuotaExceededError"));
    // Should not throw
    await enqueuePosition(makePosition(1));
    // Queue is empty because enqueue failed gracefully
    expect(await queueSize()).toBe(0);
  });
});
