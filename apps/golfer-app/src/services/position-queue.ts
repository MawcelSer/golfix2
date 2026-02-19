import { get, set, del, createStore } from "idb-keyval";
import type { PositionUpdate } from "@golfix/shared";

const STORE_KEY = "pending";
const MAX_QUEUE_SIZE = 2000;

const positionStore = createStore("golfix-positions", "queue");

export async function enqueuePosition(position: PositionUpdate): Promise<void> {
  try {
    const queue = (await get<PositionUpdate[]>(STORE_KEY, positionStore)) ?? [];

    while (queue.length >= MAX_QUEUE_SIZE) {
      queue.shift();
    }

    queue.push(position);
    await set(STORE_KEY, queue, positionStore);
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
