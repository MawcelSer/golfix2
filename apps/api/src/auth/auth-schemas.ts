import { z } from "zod";

// ── Request schemas ─────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z
    .string()
    .email()
    .max(255)
    .transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  displayName: z
    .string()
    .min(1)
    .max(100)
    .transform((s) => s.trim()),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1),
});

export const anonymousSchema = z.object({
  displayName: z.string().min(1).max(100),
  deviceId: z
    .string()
    .min(8)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Inferred types ──────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AnonymousInput = z.infer<typeof anonymousSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

// ── Response types ──────────────────────────────────────────────────

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
