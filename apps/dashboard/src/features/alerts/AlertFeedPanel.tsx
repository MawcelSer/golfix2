import { useState } from "react";
import type { DashboardAlertEvent } from "@golfix/shared";
import { AlertCard } from "./AlertCard";

type SeverityFilter = "all" | "info" | "warning" | "critical";

const FILTERS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "critical", label: "Critique" },
  { value: "warning", label: "Attention" },
  { value: "info", label: "Info" },
];

interface AlertFeedPanelProps {
  alerts: DashboardAlertEvent[];
}

export function AlertFeedPanel({ alerts }: AlertFeedPanelProps) {
  const [filter, setFilter] = useState<SeverityFilter>("all");

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-cream/10 bg-pine/80">
      <div className="flex items-center justify-between border-b border-cream/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-cream">Alertes</h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              data-testid={`filter-${f.value}`}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                filter === f.value ? "bg-cream/20 text-cream" : "text-cream/40 hover:text-cream/60"
              }`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-cream/40">Aucune alerte</p>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto p-3" data-testid="alert-list">
          {filtered.map((alert, i) => (
            <AlertCard key={`${alert.timestamp}-${i}`} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
