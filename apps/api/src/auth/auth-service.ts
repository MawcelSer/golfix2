import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { users, refreshTokens } from "../db/schema/index";
import type {
  RegisterInput,
  LoginInput,
  AnonymousInput,
  AuthResponse,
  AuthTokens,
} from "./auth-schemas";

// ── Constants ───────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? "dev-secret-change-me";
}

// ── Password helpers ────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Token helpers ───────────────────────────────────────────────────

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): { sub: string } {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === "string" || !payload.sub) {
    throw new Error("Invalid token payload");
  }
  return { sub: payload.sub as string };
}

export async function storeRefreshToken(
  userId: string,
  rawToken: string,
): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });
}

export async function generateTokenPair(
  userId: string,
): Promise<AuthTokens> {
  const accessToken = generateAccessToken(userId);
  const rawRefreshToken = crypto.randomUUID();

  await storeRefreshToken(userId, rawRefreshToken);

  return { accessToken, refreshToken: rawRefreshToken };
}

export async function verifyRefreshToken(rawToken: string): Promise<string> {
  const tokenHash = hashToken(rawToken);

  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error("Invalid refresh token");
  }

  if (row.revokedAt !== null) {
    throw new Error("Refresh token has been revoked");
  }

  if (row.expiresAt < new Date()) {
    throw new Error("Refresh token has expired");
  }

  return row.userId;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}

// ── Auth operations ─────────────────────────────────────────────────

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const passwordHash = await hashPassword(input.password);

  const inserted = await db
    .insert(users)
    .values({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    })
    .returning({ id: users.id, displayName: users.displayName, email: users.email });

  const user = inserted[0]!;
  const tokens = await generateTokenPair(user.id);

  return {
    user: { id: user.id, displayName: user.displayName, email: user.email },
    ...tokens,
  };
}

export async function registerAnonymous(
  input: AnonymousInput,
): Promise<AuthResponse> {
  const inserted = await db
    .insert(users)
    .values({
      displayName: input.displayName,
      deviceId: input.deviceId,
    })
    .returning({ id: users.id, displayName: users.displayName, email: users.email });

  const user = inserted[0]!;
  const tokens = await generateTokenPair(user.id);

  return {
    user: { id: user.id, displayName: user.displayName, email: user.email },
    ...tokens,
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  const user = rows[0];
  if (!user || !user.passwordHash) {
    throw new Error("Invalid credentials");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const tokens = await generateTokenPair(user.id);

  return {
    user: { id: user.id, displayName: user.displayName, email: user.email },
    ...tokens,
  };
}
