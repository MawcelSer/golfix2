// ── Client → Server events ─────────────────────────────────────────

export interface PositionUpdate {
  sessionId: string;
  lat: number;
  lng: number;
  accuracy: number;
  recordedAt: string;
}

// ── Server → Client events ─────────────────────────────────────────

export interface PositionBroadcast {
  sessionId: string;
  lat: number;
  lng: number;
  accuracy: number;
  holeNumber: number | null;
  recordedAt: string;
}

export interface SocketError {
  message: string;
}

// ── Event name constants ───────────────────────────────────────────

export const SOCKET_EVENTS = {
  // Client → Server
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  AUTH_REFRESH: "auth:refresh",
  POSITION_UPDATE: "position:update",

  // Server → Client
  AUTH_REFRESHED: "auth:refreshed",
  POSITION_BROADCAST: "position:broadcast",
  ERROR: "error",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
