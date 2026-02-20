/**
 * Load test script for Golfix API.
 * Run: npx tsx tools/load-test.ts <api-url>
 *
 * Simulates concurrent golfer sessions:
 * 1. Anonymous login
 * 2. Locate course
 * 3. Start session
 * 4. Send position batches every 3s
 * 5. WebSocket connection
 */

import { io, type Socket } from "socket.io-client";

const API_URL = process.argv[2] ?? "http://localhost:3000";
const CONCURRENT = Number(process.argv[3] ?? "50");
const DURATION_MS = 60_000;

interface SessionResult {
  index: number;
  success: boolean;
  requestCount: number;
  latencies: number[];
  wsConnected: boolean;
  error?: string;
}

async function apiCall(
  url: string,
  method: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; data: unknown; latencyMs: number }> {
  const start = performance.now();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const latencyMs = performance.now() - start;
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  return { status: res.status, data, latencyMs };
}

async function simulateSession(index: number): Promise<SessionResult> {
  const result: SessionResult = {
    index,
    success: false,
    requestCount: 0,
    latencies: [],
    wsConnected: false,
  };

  let socket: Socket | undefined;

  try {
    // 1. Anonymous login
    const auth = await apiCall("/api/v1/auth/anonymous", "POST", undefined, {
      displayName: `LoadTest-${index}`,
    });
    result.requestCount++;
    result.latencies.push(auth.latencyMs);

    if (auth.status !== 201) {
      result.error = `Auth failed: ${auth.status}`;
      return result;
    }

    const { accessToken } = auth.data as { accessToken: string };

    // 2. Health check (warm up)
    const health = await apiCall("/api/v1/health", "GET");
    result.requestCount++;
    result.latencies.push(health.latencyMs);

    // 3. Connect WebSocket
    socket = io(API_URL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS timeout")), 5000);
      socket!.on("connect", () => {
        clearTimeout(timeout);
        result.wsConnected = true;
        resolve();
      });
      socket!.on("connect_error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // 4. Send position batches for DURATION_MS
    const endTime = Date.now() + DURATION_MS;
    const baseLat = 48.85 + Math.random() * 0.01;
    const baseLng = 2.29 + Math.random() * 0.01;

    while (Date.now() < endTime) {
      const batch = await apiCall("/api/v1/positions/batch", "POST", accessToken, {
        sessionId: "00000000-0000-0000-0000-000000000000", // dummy
        positions: [
          {
            latitude: baseLat + Math.random() * 0.001,
            longitude: baseLng + Math.random() * 0.001,
            accuracy: 5 + Math.random() * 10,
            recordedAt: new Date().toISOString(),
          },
        ],
      });
      result.requestCount++;
      result.latencies.push(batch.latencyMs);

      // Wait 3 seconds between batches
      await new Promise((r) => setTimeout(r, 3000));
    }

    result.success = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    socket?.disconnect();
  }

  return result;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

async function main() {
  console.log(`\n🏌️ Golfix Load Test`);
  console.log(`  Target: ${API_URL}`);
  console.log(`  Concurrent sessions: ${CONCURRENT}`);
  console.log(`  Duration: ${DURATION_MS / 1000}s\n`);

  const start = performance.now();
  const sessions = Array.from({ length: CONCURRENT }, (_, i) => simulateSession(i));
  const results = await Promise.allSettled(sessions);
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);

  // Aggregate results
  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.success);
  const failed = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success),
  );
  const wsConnected = results.filter(
    (r) => r.status === "fulfilled" && r.value.wsConnected,
  ).length;

  const allLatencies = results
    .filter((r): r is PromiseFulfilledResult<SessionResult> => r.status === "fulfilled")
    .flatMap((r) => r.value.latencies)
    .sort((a, b) => a - b);

  const totalRequests = results
    .filter((r): r is PromiseFulfilledResult<SessionResult> => r.status === "fulfilled")
    .reduce((sum, r) => sum + r.value.requestCount, 0);

  console.log(`\n--- Results (${elapsed}s) ---`);
  console.log(`  Sessions: ${succeeded.length}/${CONCURRENT} succeeded`);
  console.log(`  WebSocket: ${wsConnected}/${CONCURRENT} connected`);
  console.log(`  Total requests: ${totalRequests}`);

  if (allLatencies.length > 0) {
    console.log(`\n  Latency:`);
    console.log(`    p50:  ${percentile(allLatencies, 50).toFixed(0)}ms`);
    console.log(`    p95:  ${percentile(allLatencies, 95).toFixed(0)}ms`);
    console.log(`    p99:  ${percentile(allLatencies, 99).toFixed(0)}ms`);
    console.log(`    max:  ${percentile(allLatencies, 100).toFixed(0)}ms`);
  }

  if (failed.length > 0) {
    console.log(`\n  Errors:`);
    for (const r of failed.slice(0, 5)) {
      if (r.status === "fulfilled") {
        console.log(`    Session ${r.value.index}: ${r.value.error}`);
      } else {
        console.log(`    ${r.reason}`);
      }
    }
    if (failed.length > 5) console.log(`    ... and ${failed.length - 5} more`);
  }

  console.log();
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
