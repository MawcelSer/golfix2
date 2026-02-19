import { get, set, del, createStore } from "idb-keyval";
import type { PositionUpdate } from "@golfix/shared";

const STORE_KEY = "pending";
const MAX_QUEUE_SIZE = 2000;

const positionStore = createStore("golfix-positions", "queue");

export async function enqueuePosition(position: PositionUpdate): Promise<void> {
  try {
    const existing = (await get<PositionUpdate[]>(STORE_KEY, positionStore)) ?? [];

    // Immutable FIFO eviction — keep newest entries to make room
    const trimmed =
      existing.length >= MAX_QUEUE_SIZE
        ? existing.slice(existing.length - MAX_QUEUE_SIZE + 1)
        : existing;

    await set(STORE_KEY, [...trimmed, position], positionStore);
  } catch (err) {
    console.warn("[position-queue] Failed to enqueue:", err);
  }
}

export async function drainAll(): Promise<PositionUpdate[]> {
  try {
    return (await get<PositionUpdate[]>(STORE_KEY, positionStore)) ?? [];
  } catch (err) {
    console.warn("[position-queue] Failed to drain:", err);
    return [];
  }
}

/**
 * Remove the first `count` entries from the queue.
 * Used after a successful batch POST to avoid deleting
 * positions that were enqueued during the API call.
 */
export async function removeN(count: number): Promise<void> {
  try {
    const queue = (await get<PositionUpdate[]>(STORE_KEY, positionStore)) ?? [];
    if (count >= queue.length) {
      await del(STORE_KEY, positionStore);
    } else {
      await set(STORE_KEY, queue.slice(count), positionStore);
    }
  } catch (err) {
    console.warn("[position-queue] Failed to remove:", err);
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await del(STORE_KEY, positionStore);
  } catch (err) {
    console.warn("[position-queue] Failed to clear:", err);
  }
}

export async function queueSize(): Promise<number> {
  try {
    const queue = (await get<PositionUpdate[]>(STORE_KEY, positionStore)) ?? [];
    return queue.length;
  } catch (err) {
    console.warn("[position-queue] Failed to get size:", err);
    return 0;
  }
}
