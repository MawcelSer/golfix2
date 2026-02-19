export interface NotificationPrefs {
  paceReminders: boolean;
}

export interface UpdatePrefsInput {
  paceReminders?: boolean;
}

export interface UserPrefsResponse {
  notificationPrefs: NotificationPrefs;
}
