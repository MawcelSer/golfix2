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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cream/10 text-cream/50">
            <th className="py-2 text-left font-medium">Trou</th>
            <th className="py-2 text-center font-medium">Par</th>
            <th className="py-2 text-center font-medium">Score</th>
            <th className="py-2 text-center font-medium">+/−</th>
            <th className="py-2 text-center font-medium">Putts</th>
          </tr>
        </thead>
        <tbody>
          {holeDetails.map((h) => (
            <tr key={h.holeNumber} className="border-b border-cream/5">
              <td className="py-2 text-cream">{h.holeNumber}</td>
              <td className="py-2 text-center text-cream/60">{h.par}</td>
              <td className="py-2 text-center font-medium text-cream">{h.strokes}</td>
              <td className={`py-2 text-center font-medium ${vsParColor(h.vsPar)}`}>
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
