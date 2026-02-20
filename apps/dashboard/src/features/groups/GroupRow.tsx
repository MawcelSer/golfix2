import type { DashboardGroupUpdate } from "@golfix/shared";
import { PaceStatusBadge } from "./PaceStatusBadge";

interface GroupRowProps {
  group: DashboardGroupUpdate;
}

function formatProjectedFinish(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function GroupRow({ group }: GroupRowProps) {
  return (
    <tr
      data-testid={`group-row-${group.groupId}`}
      className="border-b border-cream/10 hover:bg-cream/5"
    >
      <td className="px-3 py-2 text-sm font-medium text-cream">{group.groupNumber}</td>
      <td className="px-3 py-2 text-sm text-cream/70">{group.sessions.length}</td>
      <td className="px-3 py-2 text-sm text-cream/70">{group.currentHole}</td>
      <td className="px-3 py-2">
        <PaceStatusBadge status={group.paceStatus} />
      </td>
      <td className="px-3 py-2 text-sm text-cream/70">{group.paceFactor.toFixed(2)}</td>
      <td className="px-3 py-2 text-sm text-cream/70">
        {formatProjectedFinish(group.projectedFinish)}
      </td>
    </tr>
  );
}
