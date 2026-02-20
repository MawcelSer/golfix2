import type { DashboardAlertEvent } from "@golfix/shared";
import { formatAlertTitle, formatAlertDescription, formatAlertTime } from "./format-alert";

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-l-blue-400",
  warning: "border-l-amber-400",
  critical: "border-l-red-500",
};

interface AlertCardProps {
  alert: DashboardAlertEvent;
}

export function AlertCard({ alert }: AlertCardProps) {
  const borderClass = SEVERITY_STYLES[alert.severity] ?? "border-l-cream/20";

  return (
    <div
      data-testid={`alert-card`}
      data-severity={alert.severity}
      className={`border-l-4 ${borderClass} rounded-r-lg bg-pine/60 px-3 py-2`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-cream">{formatAlertTitle(alert)}</span>
        <span className="text-[10px] text-cream/40">{formatAlertTime(alert.timestamp)}</span>
      </div>
      <p className="mt-0.5 text-xs text-cream/60">{formatAlertDescription(alert)}</p>
    </div>
  );
}
