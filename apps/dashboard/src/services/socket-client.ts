import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@golfix/shared";
import type {
  DashboardGroupUpdate,
  DashboardAlertEvent,
  DashboardBottleneckEvent,
  SocketError,
} from "@golfix/shared";

export interface DashboardSocketOptions {
  url: string;
  token: string;
}

export class DashboardSocketClient {
  private socket: Socket | null = null;

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  connect(options: DashboardSocketOptions): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(options.url, {
      auth: { token: options.token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
  }

  joinDashboardRoom(courseId: string): void {
    this.socket?.emit(SOCKET_EVENTS.ROOM_JOIN, `course:${courseId}:dashboard`);
  }

  leaveDashboardRoom(courseId: string): void {
    this.socket?.emit(SOCKET_EVENTS.ROOM_LEAVE, `course:${courseId}:dashboard`);
  }

  refreshAuth(token: string): void {
    this.socket?.emit(SOCKET_EVENTS.AUTH_REFRESH, token);
  }

  onConnect(cb: () => void): void {
    this.socket?.on("connect", cb);
  }

  onDisconnect(cb: (reason: string) => void): void {
    this.socket?.on("disconnect", cb);
  }

  onError(cb: (err: SocketError) => void): void {
    this.socket?.on(SOCKET_EVENTS.ERROR, cb);
  }

  onGroupsUpdate(cb: (groups: DashboardGroupUpdate[]) => void): void {
    this.socket?.on(SOCKET_EVENTS.GROUPS_UPDATE, cb);
  }

  onAlertNew(cb: (alert: DashboardAlertEvent) => void): void {
    this.socket?.on(SOCKET_EVENTS.ALERT_NEW, cb);
  }

  onBottleneckUpdate(cb: (bottlenecks: DashboardBottleneckEvent[]) => void): void {
    this.socket?.on(SOCKET_EVENTS.BOTTLENECK_UPDATE, cb);
  }

  onAuthRefreshed(cb: () => void): void {
    this.socket?.on(SOCKET_EVENTS.AUTH_REFRESHED, cb);
  }

  destroy(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}
