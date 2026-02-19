import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, ApiError } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useGeolocation } from "@/hooks/use-geolocation";
import { GdprConsentModal } from "@/features/consent/GdprConsentModal";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { InstallBanner } from "@/components/InstallBanner";
import type { RoundSummaryResponse, CourseMatch } from "@golfix/shared";

export function LandingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const gdprConsent = useAuthStore((s) => s.gdprConsent);
  const { position, startWatching } = useGeolocation();

  const [rounds, setRounds] = useState<RoundSummaryResponse[]>([]);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGdpr, setShowGdpr] = useState(false);

  const { canInstall, promptInstall } = useInstallPrompt();
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem("golfix-install-dismissed") === "true",
  );

  function handleDismissInstall() {
    setInstallDismissed(true);
    localStorage.setItem("golfix-install-dismissed", "true");
  }

  useEffect(() => {
    apiClient
      .get<RoundSummaryResponse[]>("/users/me/rounds")
      .then(setRounds)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return;
        console.error("Failed to fetch rounds:", err);
      });
  }, []);

  const locateCourse = useCallback(async () => {
    if (!position) {
      startWatching();
      setLocateMessage("Acquisition GPS en cours…");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLocateMessage(null);

    try {
      const result = await apiClient.post<CourseMatch>("/courses/locate", {
        lat: position.lat,
        lng: position.lng,
      });
      navigate(`/gps?course=${result.slug}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        setLocateMessage("Vous n'êtes pas sur un parcours");
      } else {
        setLocateMessage("Erreur de localisation");
        console.error("Locate failed:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [position, startWatching, navigate]);

  function handleStart() {
    if (!gdprConsent) {
      setShowGdpr(true);
      return;
    }
    locateCourse();
  }

  function handleGdprClose() {
    setShowGdpr(false);
    if (useAuthStore.getState().gdprConsent) {
      locateCourse();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-pine px-6 pt-12">
      <img src="/icons/app-logo.png" alt="Golfix" className="mb-4 h-16 w-16 self-start" />
      <h1 className="mb-2 text-2xl font-semibold text-cream">
        Bienvenue{user?.displayName ? `, ${user.displayName}` : ""}
      </h1>

      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-green-mid py-4 text-lg font-semibold text-cream disabled:opacity-50"
      >
        {loading ? "Localisation..." : "Démarrer un parcours"}
      </button>

      {locateMessage && <p className="mt-4 text-center text-sm text-gold">{locateMessage}</p>}

      {canInstall && !installDismissed && (
        <div className="mt-4">
          <InstallBanner onInstall={promptInstall} onDismiss={handleDismissInstall} />
        </div>
      )}

      {rounds.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-cream/70">Dernières parties</h2>
          <div className="space-y-2">
            {rounds.map((round) => (
              <div
                key={round.id}
                className="flex items-center justify-between rounded-lg bg-cream/5 px-4 py-3"
              >
                <span className="text-sm text-cream/70">
                  {new Date(round.startedAt).toLocaleDateString("fr-FR")}
                </span>
                <span className="font-mono text-lg font-medium text-cream">
                  {round.computedTotalStrokes}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <GdprConsentModal open={showGdpr} onClose={handleGdprClose} />
    </div>
  );
}
