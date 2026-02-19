export interface NotificationPrefs {
  pace_reminders: boolean;
}

export interface UpdatePrefsInput {
  paceReminders?: boolean;
}

export interface UserPrefsResponse {
  notificationPrefs: NotificationPrefs;
}
