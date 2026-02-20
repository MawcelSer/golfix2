import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/api-client";
import type { UserPrefsResponse, NotificationPrefs } from "@golfix/shared";

function getInitial(name: string | undefined): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [paceReminders, setPaceReminders] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;

    apiClient
      .get<UserPrefsResponse>("/users/me/preferences")
      .then((data) => {
        if (stale) return;
        const prefs: NotificationPrefs = data.notificationPrefs;
        setPaceReminders(prefs.pace_reminders);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (stale) return;
        console.warn("Failed to load preferences:", err);
        setPaceReminders(true); // fallback to default on error
        setLoading(false);
      });

    return () => {
      stale = true;
    };
  }, []);

  const handleToggle = useCallback(async () => {
    if (paceReminders === null) return;
    const newValue = !paceReminders;
    setPaceReminders(newValue); // optimistic

    try {
      await apiClient.patch<UserPrefsResponse>("/users/me/preferences", {
        paceReminders: newValue,
      });
    } catch (err: unknown) {
      console.warn("Failed to update preferences:", err);
      setPaceReminders(!newValue); // revert
    }
  }, [paceReminders]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-6">
      <h1 className="font-display text-2xl text-cream">Profil</h1>

      {/* User info with avatar */}
      <div className="flex items-center gap-4 rounded-2xl bg-cream/5 px-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-mid">
          <span className="font-display text-lg text-cream">{getInitial(user?.displayName)}</span>
        </div>
        <div>
          <p className="text-lg font-medium text-cream">{user?.displayName ?? "\u2014"}</p>
          {user?.email && <p className="text-sm text-cream/50">{user.email}</p>}
        </div>
      </div>

      {/* Notification prefs */}
      <div className="rounded-2xl bg-cream/5 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-cream">Rappels de rythme</p>
            <p className="text-xs text-cream/50">Notifications pendant la partie</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={paceReminders ?? false}
            disabled={loading || paceReminders === null}
            onClick={handleToggle}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              paceReminders ? "bg-green-mid" : "bg-cream/20"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-cream transition-transform ${
                paceReminders ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className="mt-auto mb-8 w-full rounded-xl border border-cream/20 py-3 text-sm font-medium text-cream/70"
      >
        Se déconnecter
      </button>
    </div>
  );
}
