import { useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCourseStore } from "@/stores/course-store";
import { useRoundStore } from "@/stores/round-store";
import { useSessionStore } from "@/stores/session-store";
import { computeRoundStats } from "./compute-stats";
import { StatsSummary } from "./StatsSummary";
import { HoleBreakdown } from "./HoleBreakdown";

export function RoundSummaryScreen() {
  const navigate = useNavigate();
  const courseData = useCourseStore((s) => s.courseData);
  const scores = useRoundStore((s) => s.scores);
  const roundReset = useRoundStore((s) => s.reset);
  const sessionReset = useSessionStore((s) => s.reset);
  const didRedirect = useRef(false);

  // Redirect if no data — runs only on mount
  useEffect(() => {
    if (scores.size === 0 && !didRedirect.current) {
      didRedirect.current = true;
      navigate("/", { replace: true });
    }
  }, [scores, navigate]);

  const handleGoHome = useCallback(() => {
    roundReset();
    sessionReset();
    navigate("/");
  }, [roundReset, sessionReset, navigate]);

  if (scores.size === 0) return null;
  if (!courseData) return null;

  const stats = computeRoundStats(scores, courseData.holes);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-6">
      <h1 className="text-center font-display text-xl text-cream">Résumé de la partie</h1>

      <StatsSummary stats={stats} />

      <HoleBreakdown holeDetails={stats.holeDetails} />

      <button
        type="button"
        onClick={handleGoHome}
        className="mt-auto w-full rounded-xl bg-green-mid py-4 text-lg font-medium text-cream"
      >
        Retour à l'accueil
      </button>
    </div>
  );
}
