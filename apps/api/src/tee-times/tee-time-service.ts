import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "../db/connection";
import { teeTimes, courses } from "../db/schema/index";
import type { CreateTeeTimeInput, UpdateTeeTimeInput, TeeTimeResponse } from "./tee-time-schemas";

// ── Error class ─────────────────────────────────────────────────────

export class TeeTimeError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "TeeTimeError";
    this.statusCode = statusCode;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatTeeTime(row: {
  id: string;
  courseId: string;
  scheduledAt: Date;
  playersCount: number;
  notes: string | null;
  createdAt: Date;
}): TeeTimeResponse {
  return {
    id: row.id,
    courseId: row.courseId,
    scheduledAt: row.scheduledAt.toISOString(),
    playersCount: row.playersCount,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── createTeeTime ───────────────────────────────────────────────────

export async function createTeeTime(
  courseId: string,
  input: CreateTeeTimeInput,
): Promise<TeeTimeResponse> {
  await verifyCourseExists(courseId);

  const [row] = await db
    .insert(teeTimes)
    .values({
      courseId,
      scheduledAt: new Date(input.scheduledAt),
      playersCount: input.playersCount,
      notes: input.notes ?? null,
    })
    .returning();

  return formatTeeTime(row!);
}

// ── listTeeTimes ────────────────────────────────────────────────────

export async function listTeeTimes(courseId: string, date: string): Promise<TeeTimeResponse[]> {
  await verifyCourseExists(courseId);

  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const rows = await db
    .select()
    .from(teeTimes)
    .where(
      and(
        eq(teeTimes.courseId, courseId),
        gte(teeTimes.scheduledAt, dayStart),
        lt(teeTimes.scheduledAt, dayEnd),
      ),
    )
    .orderBy(teeTimes.scheduledAt);

  return rows.map(formatTeeTime);
}

// ── getTeeTime ──────────────────────────────────────────────────────

export async function getTeeTime(teeTimeId: string, courseId: string): Promise<TeeTimeResponse> {
  const rows = await db
    .select()
    .from(teeTimes)
    .where(and(eq(teeTimes.id, teeTimeId), eq(teeTimes.courseId, courseId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new TeeTimeError("Tee time not found", 404);
  }

  return formatTeeTime(row);
}

// ── updateTeeTime ───────────────────────────────────────────────────

export async function updateTeeTime(
  teeTimeId: string,
  courseId: string,
  input: UpdateTeeTimeInput,
): Promise<TeeTimeResponse> {
  const existing = await db
    .select()
    .from(teeTimes)
    .where(and(eq(teeTimes.id, teeTimeId), eq(teeTimes.courseId, courseId)))
    .limit(1);

  if (existing.length === 0) {
    throw new TeeTimeError("Tee time not found", 404);
  }

  const updates: Record<string, unknown> = {};
  if (input.scheduledAt !== undefined) updates.scheduledAt = new Date(input.scheduledAt);
  if (input.playersCount !== undefined) updates.playersCount = input.playersCount;
  if (input.notes !== undefined) updates.notes = input.notes;

  if (Object.keys(updates).length === 0) {
    return formatTeeTime(existing[0]!);
  }

  const [updated] = await db
    .update(teeTimes)
    .set(updates)
    .where(eq(teeTimes.id, teeTimeId))
    .returning();

  return formatTeeTime(updated!);
}

// ── deleteTeeTime ───────────────────────────────────────────────────

export async function deleteTeeTime(teeTimeId: string, courseId: string): Promise<void> {
  const result = await db
    .delete(teeTimes)
    .where(and(eq(teeTimes.id, teeTimeId), eq(teeTimes.courseId, courseId)))
    .returning({ id: teeTimes.id });

  if (result.length === 0) {
    throw new TeeTimeError("Tee time not found", 404);
  }
}

// ── Internal helpers ────────────────────────────────────────────────

async function verifyCourseExists(courseId: string): Promise<void> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (rows.length === 0) {
    throw new TeeTimeError("Course not found", 404);
  }
}
