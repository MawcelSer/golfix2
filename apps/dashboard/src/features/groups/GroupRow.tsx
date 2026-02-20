import type { DashboardGroupUpdate } from "@golfix/shared";
import { PaceStatusBadge } from "./PaceStatusBadge";

interface GroupRowProps {
  group: DashboardGroupUpdate;
  onReminder?: (group: DashboardGroupUpdate) => void;
}

function formatProjectedFinish(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const REMINDER_STATUSES = new Set(["attention", "behind"]);

export function GroupRow({ group, onReminder }: GroupRowProps) {
  const showReminder = onReminder && REMINDER_STATUSES.has(group.paceStatus);

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
      <td className="px-3 py-2">
        {showReminder && (
          <button
            data-testid={`reminder-btn-${group.groupId}`}
            onClick={() => onReminder(group)}
            className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-500/30"
          >
            Rappel
          </button>
        )}
      </td>
    </tr>
  );
}
