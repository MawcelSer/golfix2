import type { PaceStatus } from "@golfix/shared";

const STATUS_CONFIG: Record<PaceStatus, { label: string; className: string }> = {
  ahead: { label: "En avance", className: "bg-green-400/20 text-green-400" },
  on_pace: { label: "Dans le temps", className: "bg-green-500/20 text-green-500" },
  attention: { label: "Attention", className: "bg-amber-400/20 text-amber-400" },
  behind: { label: "En retard", className: "bg-red-500/20 text-red-400" },
};

interface PaceStatusBadgeProps {
  status: PaceStatus;
}

export function PaceStatusBadge({ status }: PaceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      data-testid="pace-badge"
      data-status={status}
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
