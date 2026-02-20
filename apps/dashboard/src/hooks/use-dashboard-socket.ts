import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { DashboardSocketClient } from "@/services/socket-client";
import { WS_URL } from "@/lib/constants";

export function useDashboardSocket(courseId: string | undefined): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { setGroups, addAlert, setBottlenecks, setConnected, reset } = useDashboardStore();
  const clientRef = useRef<DashboardSocketClient | null>(null);

  useEffect(() => {
    if (!courseId || !accessToken) return;

    const client = new DashboardSocketClient();
    clientRef.current = client;

    client.connect({ url: WS_URL, token: accessToken });

    client.onConnect(() => {
      setConnected(true);
      client.joinDashboardRoom(courseId);
    });

    client.onDisconnect(() => {
      setConnected(false);
    });

    client.onGroupsUpdate((groups) => {
      setGroups(groups);
    });

    client.onAlertNew((alert) => {
      addAlert(alert);
    });

    client.onBottleneckUpdate((bottlenecks) => {
      setBottlenecks(bottlenecks);
    });

    client.onError((err) => {
      console.warn("[DashboardSocket] Error:", err.message);
    });

    return () => {
      if (courseId) {
        client.leaveDashboardRoom(courseId);
      }
      client.destroy();
      clientRef.current = null;
      reset();
    };
  }, [courseId, accessToken, setGroups, addAlert, setBottlenecks, setConnected, reset]);
}
