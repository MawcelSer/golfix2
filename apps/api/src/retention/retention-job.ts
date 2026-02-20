import cron from "node-cron";
import { db } from "../db/connection";
import { sessions, positions } from "../db/schema/tracking";
import { eq, sql } from "drizzle-orm";

interface Logger {
  info(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

const RETENTION_MONTHS = 12;

interface RetentionResult {
  sessionsProcessed: number;
  positionsDeleted: number;
}

interface PositionSummary {
  count: number;
  firstRecordedAt: string;
  lastRecordedAt: string;
}

export async function processRetention(): Promise<RetentionResult> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

  let sessionsProcessed = 0;
  let positionsDeleted = 0;

  // Find sessions with ALL positions older than cutoff
  // (sessions where the most recent position is before cutoff)
  const cutoffIso = cutoffDate.toISOString();
  const oldSessions = await db.execute<{ session_id: string; pos_count: number }>(sql`
    SELECT p.session_id, COUNT(*)::int AS pos_count
    FROM positions p
    GROUP BY p.session_id
    HAVING MAX(p.recorded_at) < ${cutoffIso}::timestamptz
  `);

  for (const row of oldSessions) {
    // Compute summary
    const [summary] = await db.execute<{
      first_recorded_at: string;
      last_recorded_at: string;
    }>(sql`
      SELECT
        MIN(recorded_at)::text AS first_recorded_at,
        MAX(recorded_at)::text AS last_recorded_at
      FROM positions
      WHERE session_id = ${row.session_id}
    `);

    if (summary) {
      const positionSummary: PositionSummary = {
        count: row.pos_count,
        firstRecordedAt: summary.first_recorded_at,
        lastRecordedAt: summary.last_recorded_at,
      };

      // Store summary on session
      await db.update(sessions).set({ positionSummary }).where(eq(sessions.id, row.session_id));

      // Delete raw positions
      await db.delete(positions).where(eq(positions.sessionId, row.session_id));

      sessionsProcessed++;
      positionsDeleted += row.pos_count;
    }
  }

  return { sessionsProcessed, positionsDeleted };
}

export function startRetentionCron(logger: Logger): void {
  const schedule = process.env.RETENTION_CRON ?? "0 3 * * *"; // daily at 3 AM
  cron.schedule(schedule, async () => {
    try {
      const result = await processRetention();
      if (result.sessionsProcessed > 0) {
        logger.info(
          {
            sessionsProcessed: result.sessionsProcessed,
            positionsDeleted: result.positionsDeleted,
          },
          "Retention job completed",
        );
      }
    } catch (err) {
      logger.error({ err }, "Retention cron job failed");
    }
  });
}
