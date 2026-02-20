import { db } from "../db/connection";
import { users, courseRoles } from "../db/schema/core";
import { rounds, scores, sessions, refreshTokens } from "../db/schema/tracking";
import { eq, inArray, sql } from "drizzle-orm";
import { verifyPassword } from "../auth/auth-service";
import { UserNotFoundError } from "./user-service";

export class PasswordRequiredError extends Error {
  constructor() {
    super("Password confirmation required for account deletion");
    this.name = "PasswordRequiredError";
  }
}

export class InvalidPasswordError extends Error {
  constructor() {
    super("Invalid password");
    this.name = "InvalidPasswordError";
  }
}

export interface GdprExportData {
  profile: {
    email: string | null;
    displayName: string;
    handicapIndex: string | null;
    notificationPrefs: unknown;
    gdprConsentAt: Date | null;
    createdAt: Date;
  };
  rounds: Array<{
    id: string;
    courseId: string;
    startedAt: Date;
    finishedAt: Date | null;
    totalScore: number | null;
    totalPutts: number | null;
    status: string;
    scores: Array<{
      holeNumber: number;
      strokes: number;
      putts: number | null;
      fairwayHit: boolean | null;
      greenInRegulation: boolean | null;
    }>;
  }>;
  sessions: Array<{
    id: string;
    courseId: string;
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
  }>;
}

export async function exportUserData(userId: string): Promise<GdprExportData> {
  // 1. User profile
  const [user] = await db
    .select({
      email: users.email,
      displayName: users.displayName,
      handicapIndex: users.handicapIndex,
      notificationPrefs: users.notificationPrefs,
      gdprConsentAt: users.gdprConsentAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) throw new UserNotFoundError(userId);

  // 2. Rounds with scores
  const userRounds = await db
    .select({
      id: rounds.id,
      courseId: rounds.courseId,
      startedAt: rounds.startedAt,
      finishedAt: rounds.finishedAt,
      totalScore: rounds.totalScore,
      totalPutts: rounds.totalPutts,
      status: rounds.status,
    })
    .from(rounds)
    .where(eq(rounds.userId, userId));

  const roundsWithScores = await Promise.all(
    userRounds.map(async (round) => {
      const roundScores = await db
        .select({
          holeNumber: scores.holeNumber,
          strokes: scores.strokes,
          putts: scores.putts,
          fairwayHit: scores.fairwayHit,
          greenInRegulation: scores.greenInRegulation,
        })
        .from(scores)
        .where(eq(scores.roundId, round.id));

      return { ...round, scores: roundScores };
    }),
  );

  // 3. Sessions (no raw positions — too large)
  const userSessions = await db
    .select({
      id: sessions.id,
      courseId: sessions.courseId,
      startedAt: sessions.startedAt,
      finishedAt: sessions.finishedAt,
      status: sessions.status,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  return {
    profile: user,
    rounds: roundsWithScores,
    sessions: userSessions,
  };
}

export async function deleteUserAccount(userId: string, password?: string): Promise<void> {
  // 1. Verify user exists and check password
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) throw new UserNotFoundError(userId);

  if (user.passwordHash) {
    if (!password) throw new PasswordRequiredError();
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new InvalidPasswordError();
  }

  // 2. Delete scores (via rounds)
  const userRounds = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(eq(rounds.userId, userId));
  const roundIds = userRounds.map((r) => r.id);
  if (roundIds.length > 0) {
    await db.delete(scores).where(inArray(scores.roundId, roundIds));
  }

  // 3. Delete rounds
  await db.delete(rounds).where(eq(rounds.userId, userId));

  // 4. Anonymize sessions (keep positions for analytics)
  await db
    .update(sessions)
    .set({ userId: sql`NULL` })
    .where(eq(sessions.userId, userId));

  // 5. Delete refresh tokens
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

  // 6. Delete course roles
  await db.delete(courseRoles).where(eq(courseRoles.userId, userId));

  // 7. Delete user
  await db.delete(users).where(eq(users.id, userId));
}
