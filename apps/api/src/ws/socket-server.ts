import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { verifyAccessToken } from "../auth/auth-service";
import { registerPositionHandler } from "./position-handler";
import type { PaceEngineManager } from "../pace/pace-engine-manager";

// ── Types ──────────────────────────────────────────────────────────

export interface SocketAuthData {
  userId: string;
}

declare module "socket.io" {
  // Extend the built-in SocketData to include our auth fields
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface SocketData extends SocketAuthData {}
}

// ── Room validation ────────────────────────────────────────────────

const ROOM_PATTERN = /^course:[0-9a-f-]{36}:(positions|dashboard)$/;

function isValidRoom(room: string): boolean {
  return ROOM_PATTERN.test(room);
}

// ── Setup ──────────────────────────────────────────────────────────

export function setupSocketServer(app: FastifyInstance): Server {
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : ["https://localhost:5173", "https://localhost:5174"];

  const io = new Server(app.server, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    path: "/socket.io",
  });

  // ── JWT auth middleware ────────────────────────────────────────

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data = { userId: payload.sub };
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  // ── Connection handler ────────────────────────────────────────

  io.on("connection", (socket) => {
    app.log.info({ socketId: socket.id, userId: socket.data.userId }, "Socket connected");

    // ── Room management ───────────────────────────────────────

    socket.on("room:join", (room: string) => {
      if (!isValidRoom(room)) {
        socket.emit("error", { message: "Invalid room format" });
        return;
      }
      void socket.join(room);
      app.log.debug({ socketId: socket.id, room }, "Joined room");
    });

    socket.on("room:leave", (room: string) => {
      if (!isValidRoom(room)) {
        socket.emit("error", { message: "Invalid room format" });
        return;
      }
      void socket.leave(room);
      app.log.debug({ socketId: socket.id, room }, "Left room");
    });

    // ── Auth refresh ──────────────────────────────────────────

    socket.on("auth:refresh", (token: string) => {
      if (!token || typeof token !== "string") {
        socket.emit("error", { message: "Token is required" });
        return;
      }

      try {
        const payload = verifyAccessToken(token);
        socket.data = { userId: payload.sub };
        socket.emit("auth:refreshed");
      } catch {
        socket.emit("error", { message: "Invalid or expired token" });
      }
    });

    // ── Position handler ──────────────────────────────────────

    // Lazy access: paceEngineManager is decorated after socket server setup
    const manager = (app as unknown as { paceEngineManager?: PaceEngineManager }).paceEngineManager;
    registerPositionHandler(io, socket, manager);

    // ── Disconnect ────────────────────────────────────────────

    socket.on("disconnect", (reason) => {
      app.log.info(
        { socketId: socket.id, userId: socket.data.userId, reason },
        "Socket disconnected",
      );
    });
  });

  return io;
}
