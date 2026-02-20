import { useState } from "react";
import type { DashboardGroupUpdate } from "@golfix/shared";
import { GroupRow } from "./GroupRow";

type SortKey = "groupNumber" | "currentHole" | "paceStatus" | "paceFactor";

const PACE_ORDER: Record<string, number> = {
  behind: 0,
  attention: 1,
  on_pace: 2,
  ahead: 3,
};

function sortGroups(groups: DashboardGroupUpdate[], key: SortKey): DashboardGroupUpdate[] {
  return [...groups].sort((a, b) => {
    if (key === "paceStatus") {
      return (PACE_ORDER[a.paceStatus] ?? 2) - (PACE_ORDER[b.paceStatus] ?? 2);
    }
    const aVal = a[key];
    const bVal = b[key];
    if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
    return 0;
  });
}

interface GroupListPanelProps {
  groups: DashboardGroupUpdate[];
  onReminder?: (group: DashboardGroupUpdate) => void;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "groupNumber", label: "Groupe" },
  { key: "currentHole", label: "Trou" },
  { key: "paceStatus", label: "Statut" },
  { key: "paceFactor", label: "Facteur" },
];

export function GroupListPanel({ groups, onReminder }: GroupListPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>("groupNumber");
  const sorted = sortGroups(groups, sortKey);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-cream/10 bg-pine/80">
      <div className="border-b border-cream/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-cream">Groupes en jeu</h2>
      </div>
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-cream/40">Aucun groupe actif</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full" data-testid="group-table">
            <thead>
              <tr className="border-b border-cream/10">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-cream/50 hover:text-cream/80"
                    onClick={() => setSortKey(col.key)}
                    data-testid={`sort-${col.key}`}
                  >
                    {col.label}
                    {sortKey === col.key ? " ▼" : ""}
                  </th>
                ))}
                <th className="px-3 py-2 text-left text-xs font-medium text-cream/50">Joueurs</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-cream/50">
                  Fin estimée
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-cream/50" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((group) => (
                <GroupRow key={group.groupId} group={group} onReminder={onReminder} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
