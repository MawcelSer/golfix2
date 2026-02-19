import type { RoundStats } from "./compute-stats";

interface StatsSummaryProps {
  stats: RoundStats;
}

function formatVsPar(vsPar: number): string {
  if (vsPar === 0) return "E";
  return vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "\u2014";
  return `${Math.round(value)}%`;
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  const vsParColor =
    stats.vsPar === 0 ? "text-cream" : stats.vsPar < 0 ? "text-green-light" : "text-gold";

  return (
    <div className="flex flex-col gap-4">
      {/* Main score */}
      <div className="flex items-baseline justify-center gap-3">
        <span className="text-5xl font-bold text-cream">{stats.totalStrokes}</span>
        <span className={`text-2xl font-bold ${vsParColor}`}>{formatVsPar(stats.vsPar)}</span>
      </div>
      <p className="text-center text-sm text-cream/50">{stats.holesPlayed} trous joués</p>

      {/* Stat chips */}
      <div className="flex justify-center gap-3">
        <div className="rounded-lg bg-cream/5 px-4 py-2 text-center">
          <p className="text-xs text-cream/50">Putts</p>
          <p className="text-lg font-semibold text-cream">{stats.totalPutts}</p>
        </div>
        <div className="rounded-lg bg-cream/5 px-4 py-2 text-center">
          <p className="text-xs text-cream/50">FIR</p>
          <p className="text-lg font-semibold text-cream">{formatPercent(stats.firPercent)}</p>
        </div>
        <div className="rounded-lg bg-cream/5 px-4 py-2 text-center">
          <p className="text-xs text-cream/50">GIR</p>
          <p className="text-lg font-semibold text-cream">{formatPercent(stats.girPercent)}</p>
        </div>
      </div>
    </div>
  );
}
