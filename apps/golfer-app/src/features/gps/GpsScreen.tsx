import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useCourseData } from "@/hooks/use-course-data";
import { useHoleDetection } from "@/hooks/use-hole-detection";
import { useSocket } from "@/hooks/use-socket";
import { useCourseStore } from "@/stores/course-store";
import { useSessionStore } from "@/stores/session-store";
import { computeHoleDistances } from "./distance-calculator";
import { DistanceCard } from "./DistanceCard";
import { HoleSelector } from "./HoleSelector";

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
          className="rounded-lg bg-green-mid px-6 py-2 text-sm font-medium text-cream"
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

  // Session confirmation — show before starting GPS
  if (sessionStatus === "idle") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
        <h2 className="text-xl font-semibold text-cream">{courseData.name}</h2>
        <p className="text-center text-sm text-cream/60">
          {courseData.holesCount} trous — Par {courseData.par}
        </p>
        {sessionError && <p className="text-center text-sm text-gold">{sessionError}</p>}
        <button
          type="button"
          onClick={() => sessionStart(courseData.id)}
          className="w-full rounded-xl bg-green-mid py-4 text-lg font-semibold text-cream"
        >
          Commencer la session
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-4 pt-6">
      {/* Hole header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-mid">
          <span className="text-xl font-bold text-cream">{detectedHole}</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-cream">Par {hole?.par ?? "—"}</p>
          <p className="text-sm text-cream/60">{hole?.distanceMeters ?? "—"} m</p>
        </div>
        {nearGreen && (
          <span className="rounded-full bg-green-light/20 px-3 py-1 text-xs font-medium text-green-light">
            Sur le green
          </span>
        )}
      </div>

      {/* Distance cards */}
      <div className="flex flex-1 flex-col gap-3">
        <DistanceCard label="Avant" distance={distances.front} />
        <DistanceCard label="Centre" distance={distances.center} variant="primary" />
        <DistanceCard label="Arrière" distance={distances.back} />
      </div>

      {/* Hole navigation */}
      <div className="mt-4">
        <HoleSelector
          currentHole={detectedHole}
          totalHoles={courseData.holesCount}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>

      {/* GPS status footer */}
      <div className="pb-2 pt-2 text-center">
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
