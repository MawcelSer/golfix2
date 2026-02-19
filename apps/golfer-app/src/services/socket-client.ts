import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@golfix/shared";
import type { PositionUpdate, PositionBroadcast, SocketError } from "@golfix/shared";

// ── Types ──────────────────────────────────────────────────────────

export interface SocketClientOptions {
  url: string;
  token: string;
}

// ── SocketClient ───────────────────────────────────────────────────

export class SocketClient {
  private socket: Socket | null = null;

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  connect(options: SocketClientOptions): void {
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

  joinRoom(courseId: string): void {
    this.socket?.emit(SOCKET_EVENTS.ROOM_JOIN, `course:${courseId}:positions`);
  }

  leaveRoom(courseId: string): void {
    this.socket?.emit(SOCKET_EVENTS.ROOM_LEAVE, `course:${courseId}:positions`);
  }

  sendPosition(data: PositionUpdate): void {
    if (!this.socket?.connected) return;
    this.socket.emit(SOCKET_EVENTS.POSITION_UPDATE, data);
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

  onPositionBroadcast(cb: (data: PositionBroadcast) => void): void {
    this.socket?.on(SOCKET_EVENTS.POSITION_BROADCAST, cb);
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
