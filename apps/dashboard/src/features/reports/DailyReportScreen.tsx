import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient, ApiError } from "@/services/api-client";

interface DailyReport {
  date: string;
  courseId: string;
  rounds: { total: number; completed: number; avgDurationMinutes: number | null };
  sessions: { total: number; active: number; finished: number };
  paceEvents: { total: number; byType: Record<string, number>; bySeverity: Record<string, number> };
  interventions: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-cream/10 bg-cream/5 px-4 py-3">
      <p className="text-xs text-cream/50">{label}</p>
      <p className="mt-1 text-xl font-bold text-cream">{value}</p>
    </div>
  );
}

export function DailyReportScreen() {
  const { courseId } = useParams<{ courseId: string }>();
  const [date, setDate] = useState(todayISO);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;

    let stale = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const data = await apiClient.get<DailyReport>(`/courses/${courseId}/reports/daily/${date}`);
        if (stale) return;
        setReport(data);
      } catch (err) {
        if (stale) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Erreur de chargement");
        }
      } finally {
        if (!stale) setLoading(false);
      }
    }

    void load();
    return () => {
      stale = true;
    };
  }, [courseId, date]);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-cream">Rapport quotidien</h1>
        <input
          type="date"
          data-testid="date-picker"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-cream/10 bg-cream/5 px-3 py-1.5 text-sm text-cream"
        />
      </div>

      {loading && <p className="text-cream/60">Chargement du rapport...</p>}

      {error && <p className="text-red-400">{error}</p>}

      {report && !loading && (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Parties jouees" value={report.rounds.total} />
            <StatCard label="Parties terminees" value={report.rounds.completed} />
            <StatCard
              label="Duree moyenne"
              value={
                report.rounds.avgDurationMinutes ? `${report.rounds.avgDurationMinutes} min` : "—"
              }
            />
            <StatCard label="Interventions" value={report.interventions} />
          </div>

          {/* Sessions */}
          <div className="rounded-lg border border-cream/10 bg-pine/80 p-4">
            <h2 className="mb-3 text-sm font-semibold text-cream">Sessions</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Total" value={report.sessions.total} />
              <StatCard label="Actives" value={report.sessions.active} />
              <StatCard label="Terminees" value={report.sessions.finished} />
            </div>
          </div>

          {/* Pace events table */}
          <div className="rounded-lg border border-cream/10 bg-pine/80 p-4">
            <h2 className="mb-3 text-sm font-semibold text-cream">
              Evenements de rythme ({report.paceEvents.total})
            </h2>
            {report.paceEvents.total === 0 ? (
              <p className="text-sm text-cream/40">Aucun evenement</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs text-cream/50">Par type</h3>
                  <table className="w-full">
                    <tbody>
                      {Object.entries(report.paceEvents.byType).map(([type, count]) => (
                        <tr key={type} className="border-b border-cream/5">
                          <td className="py-1 text-xs text-cream/70">{type}</td>
                          <td className="py-1 text-right text-xs font-medium text-cream">
                            {count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="mb-2 text-xs text-cream/50">Par severite</h3>
                  <table className="w-full">
                    <tbody>
                      {Object.entries(report.paceEvents.bySeverity).map(([severity, count]) => (
                        <tr key={severity} className="border-b border-cream/5">
                          <td className="py-1 text-xs text-cream/70">{severity}</td>
                          <td className="py-1 text-right text-xs font-medium text-cream">
                            {count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
