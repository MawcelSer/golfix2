import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useCourseData } from "@/hooks/use-course-data";
import { useHoleDetection } from "@/hooks/use-hole-detection";
import { useSocket } from "@/hooks/use-socket";
import { useCourseStore } from "@/stores/course-store";
import { useSessionStore } from "@/stores/session-store";
import { computeHoleDistances } from "./distance-calculator";
import { DistanceTriptych } from "./DistanceTriptych";
import { HoleSelector } from "./HoleSelector";
import { HoleIllustration } from "./HoleIllustration";

export function GpsScreen() {
  const [searchParams] = useSearchParams();
  const paramSlug = searchParams.get("course");
  const storeSlug = useCourseStore((s) => s.courseSlug);
  const slug = paramSlug ?? storeSlug;

  const { courseData, loading: courseLoading, error: courseError, refetch } = useCourseData(slug);
  const { position, error: gpsError, startWatching } = useGeolocation();

  const sessionStatus = useSessionStore((s) => s.status);
  const sessionStart = useSessionStore((s) => s.startSession);
  const sessionError = useSessionStore((s) => s.error);

  // Wire WebSocket + offline queue (reads sessionId/courseId from session store)
  useSocket(position);

  const holes = useMemo(() => courseData?.holes ?? [], [courseData]);
  const { detectedHole, nearGreen, setManualHole } = useHoleDetection(position, holes);

  // Start GPS only when session is active — not on mount
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (sessionStatus === "active" && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startWatching();
    }
  }, [sessionStatus, startWatching]);

  const hole = useMemo(
    () => courseData?.holes.find((h) => h.holeNumber === detectedHole) ?? null,
    [courseData, detectedHole],
  );

  const distances = useMemo(() => {
    if (!position || !hole) return { front: null, center: null, back: null };
    return computeHoleDistances(position, hole);
  }, [position, hole]);

  const handlePrev = useCallback(() => {
    setManualHole(Math.max(1, detectedHole - 1));
  }, [detectedHole, setManualHole]);

  const handleNext = useCallback(() => {
    if (!courseData) return;
    setManualHole(Math.min(courseData.holesCount, detectedHole + 1));
  }, [courseData, detectedHole, setManualHole]);

  // Loading state
  if (courseLoading && !courseData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cream/70">Chargement du parcours…</p>
      </div>
    );
  }

  // Error state
  if (courseError && !courseData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-cream/70">{courseError}</p>
        <button
          type="button"
          onClick={refetch}
          className="rounded-xl bg-green-mid px-6 py-2 text-sm font-medium text-cream"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // No course selected
  if (!courseData) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-center text-cream/70">Aucun parcours sélectionné</p>
      </div>
    );
  }

  // Session finishing — show spinner
  if (sessionStatus === "finishing") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cream/70">Fin de session…</p>
      </div>
    );
  }

  // Session ended — offer link to summary
  if (sessionStatus === "ended") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <p className="text-cream/70">Session terminée</p>
        <a href="/summary" className="rounded-xl bg-green-mid px-6 py-3 text-sm font-medium text-cream">
          Voir le résumé
        </a>
      </div>
    );
  }

  // Session confirmation — show before starting GPS
  if (sessionStatus === "idle" || sessionStatus === "starting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
        <h2 className="font-display text-xl text-cream">{courseData.name}</h2>
        <p className="text-center text-sm text-cream/50">
          {courseData.holesCount} trous — Par {courseData.par}
        </p>
        {sessionError && <p className="text-center text-sm text-gold">{sessionError}</p>}
        <button
          type="button"
          onClick={() => sessionStart(courseData.id)}
          disabled={sessionStatus === "starting"}
          className="w-full rounded-xl bg-green-mid py-4 text-lg font-medium text-cream disabled:opacity-50"
        >
          {sessionStatus === "starting" ? "Démarrage…" : "Commencer la session"}
        </button>
      </div>
    );
  }

  // Prepare illustration props
  const teePos = hole?.teePosition ? { lat: hole.teePosition.y, lng: hole.teePosition.x } : null;
  const greenPos = hole?.greenCenter ? { lat: hole.greenCenter.y, lng: hole.greenCenter.x } : null;
  const playerPos = position ? { lat: position.lat, lng: position.lng } : null;

  return (
    <div className="flex h-full flex-col">
      {/* Hole header with navigation */}
      <HoleSelector
        currentHole={detectedHole}
        totalHoles={courseData.holesCount}
        par={hole?.par ?? null}
        distanceMeters={hole?.distanceMeters ?? null}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {/* Hole illustration */}
      <div className="flex-1 px-3 py-2">
        <HoleIllustration
          holeNumber={detectedHole}
          par={hole?.par ?? 4}
          distanceMeters={hole?.distanceMeters ?? 0}
          teePosition={teePos}
          greenCenter={greenPos}
          hazards={hole?.hazards ?? []}
          playerPosition={playerPos}
          distanceToCenter={distances.center}
        />
      </div>

      {/* Distance triptych */}
      <div className="px-3">
        <DistanceTriptych front={distances.front} center={distances.center} back={distances.back} />
      </div>

      {/* Near green badge */}
      {nearGreen && (
        <div className="mt-2 text-center">
          <span className="rounded-full bg-green-light/20 px-3 py-1 text-xs font-medium text-green-light">
            Sur le green
          </span>
        </div>
      )}

      {/* GPS status footer */}
      <div className="px-3 pb-2 pt-2 text-center">
        {gpsError && (
          <p className="text-sm text-gold">
            {gpsError === "permission_denied"
              ? "GPS refusé — activez la géolocalisation"
              : "Signal GPS indisponible"}
          </p>
        )}
        {!gpsError && position && (
          <p className="text-xs text-sage">Précision GPS : ±{Math.round(position.accuracy)} m</p>
        )}
        {!gpsError && !position && <p className="text-xs text-sage">Acquisition GPS…</p>}
      </div>
    </div>
  );
}
