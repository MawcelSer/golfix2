// ── Request types ──────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AnonymousInput {
  displayName: string;
  deviceId: string;
}

export interface RefreshInput {
  refreshToken: string;
}

// ── Response types ─────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
