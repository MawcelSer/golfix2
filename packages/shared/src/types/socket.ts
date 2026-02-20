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

// ── Dashboard events (Server → Client) ──────────────────────────────

export type PaceStatus = "ahead" | "on_pace" | "attention" | "behind";

export interface DashboardGroupUpdate {
  groupId: string;
  groupNumber: number;
  currentHole: number;
  paceStatus: PaceStatus;
  paceFactor: number;
  sessions: string[];
  projectedFinish: string | null;
  centroid: { lat: number; lng: number } | null;
}

export interface DashboardAlertEvent {
  type: string;
  severity: "info" | "warning" | "critical";
  groupId: string;
  groupNumber: number;
  currentHole: number;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface DashboardBottleneckEvent {
  hole: number;
  blockerGroupId: string;
  affectedGroupIds: string[];
  rootHole: number | null;
  isCascade: boolean;
  timestamp: string;
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

  // Server → Dashboard
  GROUPS_UPDATE: "groups:update",
  ALERT_NEW: "alert:new",
  BOTTLENECK_UPDATE: "bottleneck:update",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
