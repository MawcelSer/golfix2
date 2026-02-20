import type { DashboardGroupUpdate, PaceStatus } from "@golfix/shared";

const PACE_COLORS: Record<PaceStatus, string> = {
  ahead: "#4ade80",
  on_pace: "#22c55e",
  attention: "#f59e0b",
  behind: "#ef4444",
};

interface GroupMarkersProps {
  groups: DashboardGroupUpdate[];
}

export function GroupMarkers({ groups }: GroupMarkersProps) {
  const markersWithPos = groups.filter((g) => g.centroid !== null);

  if (markersWithPos.length === 0) return null;

  return (
    <>
      {markersWithPos.map((group) => (
        <div
          key={group.groupId}
          data-testid={`group-marker-${group.groupId}`}
          data-pace={group.paceStatus}
          className="absolute flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg"
          style={{ backgroundColor: PACE_COLORS[group.paceStatus] }}
          title={`Groupe ${group.groupNumber} — Trou ${group.currentHole}`}
        >
          {group.groupNumber}
        </div>
      ))}
    </>
  );
}

export { PACE_COLORS };
