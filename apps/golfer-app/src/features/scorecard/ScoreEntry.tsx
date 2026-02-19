import { useEffect, useRef, useCallback } from "react";
import { useRoundStore } from "@/stores/round-store";
import { StrokeCounter } from "./StrokeCounter";
import { StatToggle } from "./StatToggle";

interface ScoreEntryProps {
  holeNumber: number;
  par: number;
  holesCount: number;
  onAdvance: () => void;
}

const AUTO_ADVANCE_MS = 1500;

export function ScoreEntry({ holeNumber, par, holesCount, onAdvance }: ScoreEntryProps) {
  const score = useRoundStore((s) => s.scores.get(holeNumber));
  const setStrokes = useRoundStore((s) => s.setStrokes);
  const setPutts = useRoundStore((s) => s.setPutts);
  const toggleFairwayHit = useRoundStore((s) => s.toggleFairwayHit);
  const toggleGir = useRoundStore((s) => s.toggleGir);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasModifiedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset timer state when hole changes
  useEffect(() => {
    hasModifiedRef.current = false;
    clearTimer();
  }, [holeNumber, clearTimer]);

  // Cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  const startAutoAdvance = useCallback(() => {
    // No auto-advance on last hole
    if (holeNumber >= holesCount) return;

    clearTimer();
    timerRef.current = setTimeout(() => {
      onAdvance();
    }, AUTO_ADVANCE_MS);
  }, [holeNumber, holesCount, onAdvance, clearTimer]);

  const handleStrokesChange = useCallback(
    (value: number) => {
      setStrokes(holeNumber, value);

      if (!hasModifiedRef.current) {
        hasModifiedRef.current = true;
        startAutoAdvance();
      } else {
        // Reset timer on further interaction
        startAutoAdvance();
      }
    },
    [holeNumber, setStrokes, startAutoAdvance],
  );

  const handlePuttsChange = useCallback(
    (value: number) => {
      setPutts(holeNumber, value);
      if (hasModifiedRef.current) {
        startAutoAdvance();
      }
    },
    [holeNumber, setPutts, startAutoAdvance],
  );

  const handleFairwayToggle = useCallback(() => {
    toggleFairwayHit(holeNumber);
    if (hasModifiedRef.current) {
      startAutoAdvance();
    }
  }, [holeNumber, toggleFairwayHit, startAutoAdvance]);

  const handleGirToggle = useCallback(() => {
    toggleGir(holeNumber);
    if (hasModifiedRef.current) {
      startAutoAdvance();
    }
  }, [holeNumber, toggleGir, startAutoAdvance]);

  if (!score) return null;

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="text-center text-sm text-cream/50">Par {par}</div>

      <StrokeCounter
        label="Coups"
        value={score.strokes}
        min={1}
        max={20}
        onChange={handleStrokesChange}
      />

      <StrokeCounter
        label="Putts"
        value={score.putts}
        min={0}
        max={10}
        onChange={handlePuttsChange}
      />

      <div className="flex justify-center gap-3">
        {par >= 4 && (
          <StatToggle label="FIR" value={score.fairwayHit} onChange={handleFairwayToggle} />
        )}
        <StatToggle label="GIR" value={score.greenInRegulation} onChange={handleGirToggle} />
      </div>
    </div>
  );
}
