import { useEffect, useCallback, useRef } from "react";
import { useCourseStore } from "@/stores/course-store";
import { useRoundStore } from "@/stores/round-store";
import { HoleSelector } from "@/features/gps/HoleSelector";
import { RunningTotal } from "./RunningTotal";
import { ScoreEntry } from "./ScoreEntry";

export function ScorecardScreen() {
  const courseData = useCourseStore((s) => s.courseData);
  const { currentHole, scores, error, saving, startRound, setCurrentHole, saveScore, reset } =
    useRoundStore();

  const initializedRef = useRef(false);

  // Initialize round when course is available
  useEffect(() => {
    if (!courseData || initializedRef.current) return;
    initializedRef.current = true;

    const pars = courseData.holes.map((h) => h.par);
    startRound(courseData.id, pars);

    return () => {
      initializedRef.current = false;
    };
  }, [courseData, startRound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const handlePrev = useCallback(async () => {
    await saveScore(currentHole);
    setCurrentHole(currentHole - 1);
  }, [currentHole, saveScore, setCurrentHole]);

  const handleNext = useCallback(async () => {
    await saveScore(currentHole);
    setCurrentHole(currentHole + 1);
  }, [currentHole, saveScore, setCurrentHole]);

  const handleAdvance = useCallback(async () => {
    await saveScore(currentHole);
    setCurrentHole(currentHole + 1);
  }, [currentHole, saveScore, setCurrentHole]);

  if (!courseData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cream/50">Aucun parcours sélectionné</p>
      </div>
    );
  }

  const currentHoleData = courseData.holes.find((h) => h.holeNumber === currentHole);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-4 pt-2">
      <RunningTotal scores={scores} holes={courseData.holes} />

      {currentHoleData && (
        <ScoreEntry
          holeNumber={currentHole}
          par={currentHoleData.par}
          holesCount={courseData.holesCount}
          onAdvance={handleAdvance}
        />
      )}

      <div className="mt-auto">
        <HoleSelector
          currentHole={currentHole}
          totalHoles={courseData.holesCount}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>

      {error && <div className="px-4 text-center text-sm text-gold">{error}</div>}

      {saving && <div className="px-4 text-center text-xs text-cream/40">Sauvegarde…</div>}
    </div>
  );
}
