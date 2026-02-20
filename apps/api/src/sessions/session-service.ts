import { eq, and, sql, count } from "drizzle-orm";
import { db } from "../db/connection";
import { sessions, groups, courses, courseRoles } from "../db/schema/index";
import type { StartSessionResponse, SessionResponse } from "./session-schemas";

// ── Error class ─────────────────────────────────────────────────────

export class SessionError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "SessionError";
    this.statusCode = statusCode;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatSession(row: {
  id: string;
  userId: string | null;
  courseId: string;
  groupId: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  currentHole: number | null;
}): SessionResponse {
  return {
    id: row.id,
    userId: row.userId ?? "",
    courseId: row.courseId,
    groupId: row.groupId,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    currentHole: row.currentHole,
  };
}

const MAX_GROUP_SIZE = 4;

// ── startSession ────────────────────────────────────────────────────

export async function startSession(
  userId: string,
  courseId: string,
): Promise<StartSessionResponse> {
  // Verify course exists
  const courseRows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (courseRows.length === 0) {
    throw new SessionError("Course not found", 404);
  }

  // Check user doesn't already have an active session on this course
  const existingRows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.courseId, courseId),
        eq(sessions.status, "active"),
      ),
    )
    .limit(1);

  if (existingRows.length > 0) {
    throw new SessionError("User already has an active session on this course", 409);
  }

  const today = new Date().toISOString().split("T")[0]!;

  // Find an existing group for today with fewer than 4 active sessions
  const availableGroups = await db
    .select({
      groupId: groups.id,
      teeTimeId: groups.teeTimeId,
      activeCount: count(sessions.id),
    })
    .from(groups)
    .leftJoin(sessions, and(eq(sessions.groupId, groups.id), eq(sessions.status, "active")))
    .where(and(eq(groups.courseId, courseId), eq(groups.date, today)))
    .groupBy(groups.id, groups.teeTimeId)
    .having(sql`count(${sessions.id}) < ${MAX_GROUP_SIZE}`)
    .limit(1);

  let groupId: string;

  if (availableGroups.length > 0) {
    groupId = availableGroups[0]!.groupId;
  } else {
    // Count existing groups for today to determine groupNumber
    const groupCountRows = await db
      .select({ cnt: count(groups.id) })
      .from(groups)
      .where(and(eq(groups.courseId, courseId), eq(groups.date, today)));

    const nextGroupNumber = (groupCountRows[0]?.cnt ?? 0) + 1;

    const [newGroup] = await db
      .insert(groups)
      .values({
        courseId,
        date: today,
        groupNumber: nextGroupNumber,
      })
      .returning({ id: groups.id, teeTimeId: groups.teeTimeId });

    groupId = newGroup!.id;
  }

  // Create the session
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      courseId,
      groupId,
      startedAt: new Date(),
      status: "active",
    })
    .returning({ id: sessions.id });

  return {
    sessionId: session!.id,
    groupId,
    courseId,
  };
}

// ── finishSession ───────────────────────────────────────────────────

export async function finishSession(
  sessionId: string,
  userId: string,
  status: "finished" | "abandoned",
): Promise<SessionResponse> {
  const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

  const session = rows[0];

  if (!session) {
    throw new SessionError("Session not found", 404);
  }

  if (session.userId !== userId) {
    throw new SessionError("Not authorized to modify this session", 403);
  }

  if (session.status !== "active") {
    throw new SessionError("Session is not active", 409);
  }

  const [updated] = await db
    .update(sessions)
    .set({ status, finishedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .returning();

  return formatSession(updated!);
}

// ── getSession ──────────────────────────────────────────────────────

export async function getSession(sessionId: string, userId: string): Promise<SessionResponse> {
  const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

  const session = rows[0];

  if (!session) {
    throw new SessionError("Session not found", 404);
  }

  // Check if user owns the session or has a role on the course
  if (session.userId !== userId) {
    const roleRows = await db
      .select({ role: courseRoles.role })
      .from(courseRoles)
      .where(and(eq(courseRoles.userId, userId), eq(courseRoles.courseId, session.courseId)))
      .limit(1);

    const role = roleRows[0]?.role;

    if (!role || !["owner", "admin"].includes(role)) {
      throw new SessionError("Not authorized to view this session", 403);
    }
  }

  return formatSession(session);
}
