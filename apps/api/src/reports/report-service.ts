import { db } from "../db/connection";
import { rounds, sessions, paceEvents } from "../db/schema/tracking";
import { eq, and, gte, lt } from "drizzle-orm";

// ── Types ───────────────────────────────────────────────────────────

export interface DailyReport {
  date: string;
  courseId: string;
  rounds: {
    total: number;
    completed: number;
    avgDurationMinutes: number | null;
  };
  sessions: {
    total: number;
    active: number;
    finished: number;
  };
  paceEvents: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  interventions: number;
}

// ── getDailyReport ─────────────────────────────────────────────────

export async function getDailyReport(courseId: string, dateStr: string): Promise<DailyReport> {
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

  // Rounds stats
  const roundRows = await db
    .select({
      status: rounds.status,
      startedAt: rounds.startedAt,
      finishedAt: rounds.finishedAt,
    })
    .from(rounds)
    .where(
      and(
        eq(rounds.courseId, courseId),
        gte(rounds.startedAt, dayStart),
        lt(rounds.startedAt, dayEnd),
      ),
    );

  const completedRounds = roundRows.filter((r) => r.status === "completed");
  const durations = completedRounds
    .filter((r) => r.finishedAt)
    .map((r) => (r.finishedAt!.getTime() - r.startedAt.getTime()) / 60000);

  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  // Sessions stats
  const sessionRows = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(
      and(
        eq(sessions.courseId, courseId),
        gte(sessions.startedAt, dayStart),
        lt(sessions.startedAt, dayEnd),
      ),
    );

  const activeSessions = sessionRows.filter((s) => s.status === "active").length;
  const finishedSessions = sessionRows.filter((s) => s.status === "finished").length;

  // Pace events
  const eventRows = await db
    .select({ type: paceEvents.type, severity: paceEvents.severity })
    .from(paceEvents)
    .where(
      and(
        eq(paceEvents.courseId, courseId),
        gte(paceEvents.createdAt, dayStart),
        lt(paceEvents.createdAt, dayEnd),
      ),
    );

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const row of eventRows) {
    byType[row.type] = (byType[row.type] ?? 0) + 1;
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
  }

  const interventions = eventRows.filter((e) => e.type === "reminder_sent").length;

  return {
    date: dateStr,
    courseId,
    rounds: {
      total: roundRows.length,
      completed: completedRounds.length,
      avgDurationMinutes: avgDuration,
    },
    sessions: {
      total: sessionRows.length,
      active: activeSessions,
      finished: finishedSessions,
    },
    paceEvents: {
      total: eventRows.length,
      byType,
      bySeverity,
    },
    interventions,
  };
}
