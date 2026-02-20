import { useCallback, useEffect, useRef, useState } from "react";
import { SocketClient } from "@/services/socket-client";
import { useAuthStore } from "@/stores/auth-store";
import { useSessionStore } from "@/stores/session-store";
import { enqueuePosition, drainAll, removeN } from "@/services/position-queue";
import { apiClient } from "@/services/api-client";
import { WS_URL } from "@/lib/constants";
import type { GpsPosition } from "./use-geolocation";
import type { PositionUpdate } from "@golfix/shared";

const POSITION_INTERVAL_MS = 5000;

interface UseSocketResult {
  connected: boolean;
  error: string | null;
}

export function useSocket(position: GpsPosition | null): UseSocketResult {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SocketClient | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const sessionId = useSessionStore((s) => s.sessionId);
  const courseId = useSessionStore((s) => s.courseId);

  const positionRef = useRef(position);
  positionRef.current = position;

  const clearPositionInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const drainQueueToApi = useCallback(async (sid: string) => {
    try {
      const pending = await drainAll();
      if (pending.length === 0) return;

      const positions = pending.map(({ lat, lng, accuracy, recordedAt }) => ({
        lat,
        lng,
        accuracy,
        recordedAt,
      }));

      await apiClient.post("/positions/batch", { sessionId: sid, positions });
      // Only remove the items we sent — new items enqueued during POST are preserved
      await removeN(pending.length);
    } catch (err) {
      console.warn("[useSocket] Failed to drain position queue:", err);
    }
  }, []);

  const startPositionInterval = useCallback(
    (client: SocketClient, sid: string) => {
      clearPositionInterval();
      intervalRef.current = setInterval(async () => {
        const pos = positionRef.current;
        if (!pos) return;

        const update: PositionUpdate = {
          sessionId: sid,
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          recordedAt: new Date().toISOString(),
        };

        // Always enqueue for offline resilience
        await enqueuePosition(update);

        // Send via WS if connected
        if (client.connected) {
          client.sendPosition(update);
        }
      }, POSITION_INTERVAL_MS);
    },
    [clearPositionInterval],
  );

  useEffect(() => {
    if (!sessionId || !courseId || !accessToken) return;

    const client = new SocketClient();
    clientRef.current = client;

    client.connect({ url: WS_URL, token: accessToken });

    client.onConnect(() => {
      setConnected(true);
      setError(null);
      client.joinRoom(courseId);
      startPositionInterval(client, sessionId);
      // Replay offline queue on connect/reconnect
      drainQueueToApi(sessionId);
    });

    client.onDisconnect(() => {
      setConnected(false);
      // Do NOT clear interval — positions keep enqueueing to IndexedDB offline
      // and will be drained on the next reconnect
    });

    client.onError((err) => {
      setError(err.message);
    });

    return () => {
      clearPositionInterval();
      client.leaveRoom(courseId);
      client.destroy();
      clientRef.current = null;
    };
  }, [
    sessionId,
    courseId,
    accessToken,
    startPositionInterval,
    clearPositionInterval,
    drainQueueToApi,
  ]);

  // Refresh auth when accessToken changes mid-session
  useEffect(() => {
    if (!accessToken || !clientRef.current) return;
    clientRef.current.refreshAuth(accessToken);
  }, [accessToken]);

  return { connected, error };
}
