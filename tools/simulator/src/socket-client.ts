import { io, type Socket } from "socket.io-client";

import type { SimLogger } from "./logger";

/**
 * Socket.io client wrapper for a single simulated golfer session.
 * Connects to the API and emits position:update events.
 */
export class SocketClient {
  private socket: Socket | null = null;
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly logger: SimLogger;

  constructor(apiUrl: string, token: string, logger: SimLogger) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.token = token;
    this.logger = logger;
  }

  /** Connect to Socket.io server with JWT auth */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.apiUrl, {
        auth: { token: this.token },
        transports: ["websocket"],
        reconnection: false,
      });

      this.socket.on("connect", () => {
        this.logger.debug(`Socket connecté: ${this.socket?.id}`);
        resolve();
      });

      this.socket.on("connect_error", (err) => {
        reject(new Error(`Socket connection failed: ${err.message}`));
      });
    });
  }

  /** Join a course position room */
  joinRoom(courseId: string): void {
    this.socket?.emit("room:join", { room: `course:${courseId}:positions` });
  }

  /** Emit a position update */
  emitPosition(data: {
    sessionId: string;
    lat: number;
    lng: number;
    accuracy: number;
    recordedAt: string;
  }): void {
    this.socket?.emit("position:update", data);
  }

  /** Disconnect cleanly */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}
