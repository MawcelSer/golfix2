import type { HoleDetail } from "./compute-stats";

interface HoleBreakdownProps {
  holeDetails: HoleDetail[];
}

function vsParLabel(vsPar: number): string {
  if (vsPar === 0) return "E";
  return vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
}

function vsParColor(vsPar: number): string {
  if (vsPar < 0) return "text-green-light";
  if (vsPar > 0) return "text-gold";
  return "text-cream/70";
}

export function HoleBreakdown({ holeDetails }: HoleBreakdownProps) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-cream/5 px-3 py-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cream/10">
            <th className="py-2 text-left text-xs uppercase tracking-widest text-cream/50">
              Trou
            </th>
            <th className="py-2 text-center text-xs uppercase tracking-widest text-cream/50">
              Par
            </th>
            <th className="py-2 text-center text-xs uppercase tracking-widest text-cream/50">
              Score
            </th>
            <th className="py-2 text-center text-xs uppercase tracking-widest text-cream/50">
              +/−
            </th>
            <th className="py-2 text-center text-xs uppercase tracking-widest text-cream/50">
              Putts
            </th>
          </tr>
        </thead>
        <tbody>
          {holeDetails.map((h) => (
            <tr key={h.holeNumber} className="border-b border-cream/5">
              <td className="py-2 text-cream">{h.holeNumber}</td>
              <td className="py-2 text-center text-cream/60">{h.par}</td>
              <td className="py-2 text-center font-mono font-medium text-cream">{h.strokes}</td>
              <td className={`py-2 text-center font-mono font-medium ${vsParColor(h.vsPar)}`}>
                {vsParLabel(h.vsPar)}
              </td>
              <td className="py-2 text-center text-cream/60">{h.putts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
