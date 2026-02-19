import { db } from "../db/connection";
import { users } from "../db/schema/core";
import { eq } from "drizzle-orm";
import type { UserPrefsResponse } from "@golfix/shared";

interface NotificationPrefsRow {
  pace_reminders: boolean;
}

const DEFAULT_PREFS: NotificationPrefsRow = { pace_reminders: true };

export async function getUserPreferences(userId: string): Promise<UserPrefsResponse> {
  const [user] = await db
    .select({ notificationPrefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, userId));

  const prefs = (user?.notificationPrefs as NotificationPrefsRow | null) ?? DEFAULT_PREFS;

  return { notificationPrefs: prefs };
}

export async function updateUserPreferences(
  userId: string,
  update: { paceReminders?: boolean },
): Promise<UserPrefsResponse> {
  const current = await getUserPreferences(userId);
  const currentPrefs = current.notificationPrefs as unknown as NotificationPrefsRow;

  const merged: NotificationPrefsRow = {
    pace_reminders: update.paceReminders ?? currentPrefs.pace_reminders,
  };

  await db.update(users).set({ notificationPrefs: merged }).where(eq(users.id, userId));

  return { notificationPrefs: merged };
}
