// ── Types ──────────────────────────────────────────────────────────
export type {
  RegisterInput,
  LoginInput,
  AnonymousInput,
  RefreshInput,
  AuthTokens,
  AuthUser,
  AuthResponse,
} from "./types/auth";

export type { LocateInput, HazardData, HoleData, CourseData, CourseMatch } from "./types/course";

export type {
  StartSessionInput,
  FinishSessionInput,
  StartSessionResponse,
  SessionResponse,
} from "./types/session";

export type {
  CreateRoundInput,
  UpsertScoreInput,
  ScoreResponse,
  RoundResponse,
  RoundWithScoresResponse,
  RoundSummaryResponse,
} from "./types/scoring";

export type { PositionInput, PositionBatchInput, PositionBatchResponse } from "./types/position";

export type {
  PositionUpdate,
  PositionBroadcast,
  SocketError,
  SocketEventName,
  PaceStatus,
  DashboardGroupUpdate,
  DashboardAlertEvent,
  DashboardBottleneckEvent,
} from "./types/socket";

export { SOCKET_EVENTS } from "./types/socket";

export type { NotificationPrefs, UpdatePrefsInput, UserPrefsResponse } from "./types/preferences";

// ── Utilities ──────────────────────────────────────────────────────
export { haversineDistance } from "./utils/haversine";
