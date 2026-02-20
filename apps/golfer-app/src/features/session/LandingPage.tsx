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

  const handleDismissInstall = useCallback(() => {
    setInstallDismissed(true);
    localStorage.setItem("golfix-install-dismissed", "true");
  }, []);

  // H5: staleness guard on rounds fetch
  useEffect(() => {
    let stale = false;

    apiClient
      .get<RoundSummaryResponse[]>("/users/me/rounds")
      .then((data) => {
        if (!stale) setRounds(data);
      })
      .catch((err: unknown) => {
        if (stale) return;
        if (err instanceof ApiError && err.status === 401) return;
        console.error("Failed to fetch rounds:", err);
      });

    return () => {
      stale = true;
    };
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

  const handleStart = useCallback(() => {
    if (!gdprConsent) {
      setShowGdpr(true);
      return;
    }
    locateCourse();
  }, [gdprConsent, locateCourse]);

  const handleGdprClose = useCallback(
    (accepted: boolean) => {
      setShowGdpr(false);
      if (accepted) {
        locateCourse();
      }
    },
    [locateCourse],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-pine px-6 pt-12">
      <img src="/icons/app-logo.png" alt="Golfix" className="mb-4 h-12 w-12 self-start" />
      <h1 className="mb-1 font-display text-3xl text-cream">
        Bienvenue{user?.displayName ? `, ${user.displayName}` : ""}
      </h1>
      <p className="text-sm text-cream/50">Prêt pour le parcours ?</p>

      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className="mt-8 w-full rounded-xl bg-green-mid py-4 text-lg font-medium text-cream disabled:opacity-50"
      >
        {loading ? "Localisation..." : "Démarrer un parcours"}
      </button>

      {locateMessage && (
        <div className="mt-4 rounded-xl bg-cream/5 px-4 py-3 text-center">
          <p className="text-sm text-gold">{locateMessage}</p>
        </div>
      )}

      {canInstall && !installDismissed && (
        <div className="mt-4">
          <InstallBanner onInstall={promptInstall} onDismiss={handleDismissInstall} />
        </div>
      )}

      {rounds.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-cream/50">
            Dernières parties
          </h2>
          <div className="space-y-2">
            {rounds.map((round) => (
              <div
                key={round.id}
                className="flex items-center justify-between rounded-2xl bg-cream/5 px-4 py-3"
              >
                <span className="text-sm text-cream/60">
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
