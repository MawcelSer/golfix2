import { db } from "../db/connection";
import { users } from "../db/schema/core";
import { eq, sql } from "drizzle-orm";
import type { NotificationPrefs, UserPrefsResponse } from "@golfix/shared";

const DEFAULT_PREFS: NotificationPrefs = { pace_reminders: true };

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User ${userId} not found`);
    this.name = "UserNotFoundError";
  }
}

export async function getUserPreferences(userId: string): Promise<UserPrefsResponse> {
  const [user] = await db
    .select({ notificationPrefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) throw new UserNotFoundError(userId);

  const prefs = (user.notificationPrefs as NotificationPrefs | null) ?? DEFAULT_PREFS;

  return { notificationPrefs: prefs };
}

export async function updateUserPreferences(
  userId: string,
  update: { paceReminders?: boolean },
): Promise<UserPrefsResponse> {
  // Verify user exists
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));

  if (!user) throw new UserNotFoundError(userId);

  // Atomic JSONB merge — single statement, no TOCTOU race
  const patch: Record<string, unknown> = {};
  if (update.paceReminders !== undefined) {
    patch.pace_reminders = update.paceReminders;
  }

  await db
    .update(users)
    .set({
      notificationPrefs: sql`COALESCE(notification_prefs, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`,
    })
    .where(eq(users.id, userId));

  // Read back the merged result
  return getUserPreferences(userId);
}
