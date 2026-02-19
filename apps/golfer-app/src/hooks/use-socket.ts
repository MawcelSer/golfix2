import { useCallback, useEffect, useRef, useState } from "react";
import { SocketClient } from "../services/socket-client";
import { useAuthStore } from "../stores/auth-store";
import { useGeolocation } from "./use-geolocation";
import { WS_URL } from "../lib/constants";

const POSITION_INTERVAL_MS = 5000;

interface UseSocketResult {
  connected: boolean;
  error: string | null;
}

export function useSocket(sessionId: string | null, courseId: string | null): UseSocketResult {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SocketClient | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { position } = useGeolocation();

  // Keep position in a ref so the interval callback always reads the latest
  const positionRef = useRef(position);
  positionRef.current = position;

  const clearPositionInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPositionInterval = useCallback(
    (client: SocketClient, sid: string) => {
      clearPositionInterval();
      intervalRef.current = setInterval(() => {
        const pos = positionRef.current;
        if (!pos || !client.connected) return;
        client.sendPosition({
          sessionId: sid,
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          recordedAt: new Date().toISOString(),
        });
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
    });

    client.onDisconnect(() => {
      setConnected(false);
      clearPositionInterval();
    });

    // socket.io-client fires "connect" again after auto-reconnect
    // onConnect above handles re-joining + restarting interval

    client.onError((err) => {
      setError(err.message);
    });

    return () => {
      clearPositionInterval();
      client.leaveRoom(courseId);
      client.destroy();
      clientRef.current = null;
      setConnected(false);
    };
  }, [sessionId, courseId, accessToken, startPositionInterval, clearPositionInterval]);

  // Refresh auth when accessToken changes mid-session
  useEffect(() => {
    if (!accessToken || !clientRef.current) return;
    clientRef.current.refreshAuth(accessToken);
  }, [accessToken]);

  return { connected, error };
}
