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

function vsParBadgeClass(vsPar: number): string {
  if (vsPar < 0) return "bg-green-light/20 text-green-light";
  if (vsPar > 0) return "bg-gold/20 text-gold";
  return "bg-cream/10 text-cream";
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Main score */}
      <div className="flex flex-col items-center gap-2">
        <span className="font-display text-5xl text-cream">{stats.totalStrokes}</span>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${vsParBadgeClass(stats.vsPar)}`}
        >
          {formatVsPar(stats.vsPar)}
        </span>
      </div>
      <p className="text-center text-sm text-cream/50">{stats.holesPlayed} trous joués</p>

      {/* Stat chips */}
      <div className="flex justify-center gap-3">
        <div className="rounded-2xl bg-cream/5 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-widest text-cream/50">Putts</p>
          <p className="mt-1 font-mono text-lg font-medium text-cream">{stats.totalPutts}</p>
        </div>
        <div className="rounded-2xl bg-cream/5 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-widest text-cream/50">FIR</p>
          <p className="mt-1 font-mono text-lg font-medium text-cream">
            {formatPercent(stats.firPercent)}
          </p>
        </div>
        <div className="rounded-2xl bg-cream/5 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-widest text-cream/50">GIR</p>
          <p className="mt-1 font-mono text-lg font-medium text-cream">
            {formatPercent(stats.girPercent)}
          </p>
        </div>
      </div>
    </div>
  );
}
