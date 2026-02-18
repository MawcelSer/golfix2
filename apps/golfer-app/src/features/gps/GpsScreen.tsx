import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useCourseData } from "@/hooks/use-course-data";
import { useCourseStore } from "@/stores/course-store";
import { computeHoleDistances } from "./distance-calculator";
import { DistanceCard } from "./DistanceCard";
import { HoleSelector } from "./HoleSelector";

export function GpsScreen() {
  const [searchParams] = useSearchParams();
  const paramSlug = searchParams.get("course");
  const storeSlug = useCourseStore((s) => s.courseSlug);
  const slug = paramSlug ?? storeSlug;

  const { courseData, loading: courseLoading, error: courseError } = useCourseData(slug);
  const { position, error: gpsError, watching, startWatching } = useGeolocation();

  const [currentHole, setCurrentHole] = useState(1);

  // Start GPS when screen mounts
  useEffect(() => {
    if (!watching) startWatching();
  }, [watching, startWatching]);

  const hole = useMemo(
    () => courseData?.holes.find((h) => h.holeNumber === currentHole) ?? null,
    [courseData, currentHole],
  );

  const distances = useMemo(() => {
    if (!position || !hole) return { front: null, center: null, back: null };
    return computeHoleDistances(position, hole);
  }, [position, hole]);

  const handlePrev = useCallback(() => {
    setCurrentHole((h) => Math.max(1, h - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (!courseData) return;
    setCurrentHole((h) => Math.min(courseData.holesCount, h + 1));
  }, [courseData]);

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

  return (
    <div className="flex h-full flex-col px-4 pt-6">
      {/* Hole header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-mid">
          <span className="text-xl font-bold text-cream">{currentHole}</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-cream">Par {hole?.par ?? "—"}</p>
          <p className="text-sm text-cream/60">{hole?.distanceMeters ?? "—"} m</p>
        </div>
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
          currentHole={currentHole}
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
