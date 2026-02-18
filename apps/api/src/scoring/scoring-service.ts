import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { rounds, scores, courses, sessions } from "../db/schema/index";
import type {
  UpsertScoreInput,
  RoundResponse,
  RoundWithScoresResponse,
  RoundSummaryResponse,
  ScoreResponse,
} from "./scoring-schemas";

// ── Error class ─────────────────────────────────────────────────────

export class ScoringError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ScoringError";
    this.statusCode = statusCode;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatRound(row: {
  id: string;
  userId: string;
  courseId: string;
  sessionId: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  totalScore: number | null;
  totalPutts: number | null;
}): RoundResponse {
  return {
    id: row.id,
    userId: row.userId,
    courseId: row.courseId,
    sessionId: row.sessionId,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    totalScore: row.totalScore,
    totalPutts: row.totalPutts,
  };
}

function formatScore(row: {
  id: string;
  roundId: string;
  holeNumber: number;
  strokes: number;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
}): ScoreResponse {
  return {
    id: row.id,
    roundId: row.roundId,
    holeNumber: row.holeNumber,
    strokes: row.strokes,
    putts: row.putts,
    fairwayHit: row.fairwayHit,
    greenInRegulation: row.greenInRegulation,
  };
}

// ── createRound ─────────────────────────────────────────────────────

export async function createRound(
  userId: string,
  courseId: string,
  sessionId?: string,
): Promise<RoundResponse> {
  // Verify course exists
  const courseRows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (courseRows.length === 0) {
    throw new ScoringError("Course not found", 404);
  }

  // Verify session exists and belongs to user (if provided)
  if (sessionId) {
    const sessionRows = await db
      .select({ id: sessions.id, userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      throw new ScoringError("Session not found", 404);
    }

    if (sessionRows[0]!.userId !== userId) {
      throw new ScoringError("Session does not belong to user", 403);
    }
  }

  const [round] = await db
    .insert(rounds)
    .values({
      userId,
      courseId,
      sessionId: sessionId ?? null,
      startedAt: new Date(),
      status: "in_progress",
    })
    .returning();

  return formatRound(round!);
}

// ── upsertScore ─────────────────────────────────────────────────────

export async function upsertScore(
  roundId: string,
  userId: string,
  input: UpsertScoreInput,
): Promise<ScoreResponse> {
  // Verify round exists and belongs to user
  const roundRows = await db
    .select({ id: rounds.id, userId: rounds.userId, status: rounds.status })
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);

  if (roundRows.length === 0) {
    throw new ScoringError("Round not found", 404);
  }

  if (roundRows[0]!.userId !== userId) {
    throw new ScoringError("Not authorized to modify this round", 403);
  }

  if (roundRows[0]!.status !== "in_progress") {
    throw new ScoringError("Round is not in progress", 409);
  }

  const [score] = await db
    .insert(scores)
    .values({
      roundId,
      holeNumber: input.holeNumber,
      strokes: input.strokes,
      putts: input.putts ?? null,
      fairwayHit: input.fairwayHit ?? null,
      greenInRegulation: input.greenInRegulation ?? null,
    })
    .onConflictDoUpdate({
      target: [scores.roundId, scores.holeNumber],
      set: {
        strokes: sql`excluded.strokes`,
        putts: sql`excluded.putts`,
        fairwayHit: sql`excluded.fairway_hit`,
        greenInRegulation: sql`excluded.green_in_regulation`,
      },
    })
    .returning();

  return formatScore(score!);
}

// ── getUserRounds ───────────────────────────────────────────────────

export async function getUserRounds(userId: string): Promise<RoundSummaryResponse[]> {
  const rows = await db
    .select({
      id: rounds.id,
      userId: rounds.userId,
      courseId: rounds.courseId,
      sessionId: rounds.sessionId,
      status: rounds.status,
      startedAt: rounds.startedAt,
      finishedAt: rounds.finishedAt,
      totalScore: rounds.totalScore,
      totalPutts: rounds.totalPutts,
      computedTotalStrokes: sql<number>`coalesce(sum(${scores.strokes}), 0)`.as(
        "computed_total_strokes",
      ),
    })
    .from(rounds)
    .leftJoin(scores, eq(scores.roundId, rounds.id))
    .where(eq(rounds.userId, userId))
    .groupBy(rounds.id)
    .orderBy(rounds.startedAt);

  return rows.map((row) => ({
    ...formatRound(row),
    computedTotalStrokes: Number(row.computedTotalStrokes),
  }));
}

// ── getRoundDetail ──────────────────────────────────────────────────

export async function getRoundDetail(
  roundId: string,
  userId: string,
): Promise<RoundWithScoresResponse> {
  // Fetch the round
  const roundRows = await db
    .select()
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);

  if (roundRows.length === 0) {
    throw new ScoringError("Round not found", 404);
  }

  const round = roundRows[0]!;

  if (round.userId !== userId) {
    throw new ScoringError("Not authorized to view this round", 403);
  }

  // Fetch all scores ordered by hole number
  const scoreRows = await db
    .select()
    .from(scores)
    .where(eq(scores.roundId, roundId))
    .orderBy(scores.holeNumber);

  return {
    ...formatRound(round),
    scores: scoreRows.map(formatScore),
  };
}
