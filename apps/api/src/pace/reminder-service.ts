import { db } from "../db/connection";
import { groups, paceEvents, sessions } from "../db/schema/tracking";
import { users } from "../db/schema/core";
import { eq, and, inArray } from "drizzle-orm";

// ── Errors ──────────────────────────────────────────────────────────

export class GroupNotFoundError extends Error {
  constructor(groupId: string) {
    super(`Group ${groupId} not found`);
    this.name = "GroupNotFoundError";
  }
}

// ── sendReminder ────────────────────────────────────────────────────

interface SendReminderParams {
  courseId: string;
  groupId: string;
  sentByUserId: string;
  message?: string;
}

interface SendReminderResult {
  sent: boolean;
  recipientCount: number;
  eventId: string;
}

export async function sendReminder(params: SendReminderParams): Promise<SendReminderResult> {
  const { courseId, groupId, sentByUserId, message } = params;

  // Verify group exists and belongs to this course
  const groupRows = await db
    .select({ id: groups.id, currentHole: groups.currentHole })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.courseId, courseId)))
    .limit(1);

  const group = groupRows[0];
  if (!group) {
    throw new GroupNotFoundError(groupId);
  }

  // Count recipients: users in active sessions for this group with reminders enabled
  const sessionRows = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.groupId, groupId), eq(sessions.status, "active")));

  const userIds = sessionRows.map((r) => r.userId).filter((id): id is string => id !== null);

  let recipientCount = 0;
  if (userIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, notificationPrefs: users.notificationPrefs })
      .from(users)
      .where(inArray(users.id, userIds));

    recipientCount = userRows.filter((u) => {
      const prefs = u.notificationPrefs as { pace_reminders?: boolean } | null;
      return !prefs || prefs.pace_reminders !== false;
    }).length;
  }

  // Insert pace_event record
  const [event] = await db
    .insert(paceEvents)
    .values({
      courseId,
      groupId,
      type: "reminder_sent",
      severity: "info",
      holeNumber: group.currentHole,
      details: {
        sentByUserId,
        message: message ?? null,
        recipientCount,
      },
    })
    .returning({ id: paceEvents.id });

  return {
    sent: true,
    recipientCount,
    eventId: event!.id,
  };
}
