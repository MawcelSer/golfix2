import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCourseStore } from "@/stores/course-store";
import { useRoundStore } from "@/stores/round-store";
import { useSessionStore } from "@/stores/session-store";
import { HoleSelector } from "@/features/gps/HoleSelector";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RunningTotal } from "./RunningTotal";
import { ScoreEntry } from "./ScoreEntry";

export function ScorecardScreen() {
  const navigate = useNavigate();
  const courseData = useCourseStore((s) => s.courseData);
  const { currentHole, scores, error, saving, startRound, setCurrentHole, saveScore, reset } =
    useRoundStore();

  const sessionStatus = useSessionStore((s) => s.status);
  const finishSession = useSessionStore((s) => s.finishSession);

  const [showConfirm, setShowConfirm] = useState(false);

  // Initialize round when course is available; guard against stale courseId
  useEffect(() => {
    if (!courseData) return;

    const currentCourseId = useRoundStore.getState().courseId;
    if (currentCourseId === courseData.id) return;

    reset();
    const pars = courseData.holes.map((h) => h.par);
    startRound(courseData.id, pars);

    return () => {
      reset();
    };
  }, [courseData, startRound, reset]);

  const handlePrev = useCallback(async () => {
    await saveScore(currentHole);
    if (!useRoundStore.getState().error) {
      setCurrentHole(currentHole - 1);
    }
  }, [currentHole, saveScore, setCurrentHole]);

  const handleNext = useCallback(async () => {
    await saveScore(currentHole);
    if (!useRoundStore.getState().error) {
      setCurrentHole(currentHole + 1);
    }
  }, [currentHole, saveScore, setCurrentHole]);

  const handleFinishConfirm = useCallback(async () => {
    setShowConfirm(false);

    // Save current hole before finishing
    await saveScore(currentHole);
    if (useRoundStore.getState().error) return;

    await finishSession("finished");
    if (!useSessionStore.getState().error) {
      navigate("/summary");
    }
  }, [currentHole, saveScore, finishSession, navigate]);

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
      <h1 className="px-4 font-display text-xl text-cream">{courseData.name}</h1>

      <RunningTotal scores={scores} holes={courseData.holes} />

      {currentHoleData && (
        <ScoreEntry
          holeNumber={currentHole}
          par={currentHoleData.par}
          holesCount={courseData.holesCount}
          onAdvance={handleNext}
        />
      )}

      <div className="mt-auto">
        <HoleSelector
          currentHole={currentHole}
          totalHoles={courseData.holesCount}
          par={null}
          distanceMeters={null}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>

      {error && <div className="px-4 text-center text-sm text-gold">{error}</div>}

      {saving && <div className="px-4 text-center text-xs text-cream/40">Sauvegarde…</div>}

      {sessionStatus === "active" && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="mx-4 mt-4 rounded-xl border border-cream/20 py-3 text-sm font-medium text-cream/70"
        >
          Terminer la partie
        </button>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Terminer la partie ?"
        message="Votre score sera sauvegardé."
        confirmLabel="Terminer"
        cancelLabel="Annuler"
        onConfirm={handleFinishConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
