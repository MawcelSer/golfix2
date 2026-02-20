import type { DashboardAlertEvent } from "@golfix/shared";

const ALERT_TYPE_LABELS: Record<string, string> = {
  pace_warning: "Alerte rythme",
  pace_critical: "Rythme critique",
  gap_warning: "Ecart important",
  bottleneck: "Bouchon détecté",
  reminder_sent: "Rappel envoyé",
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Attention",
  critical: "Critique",
};

export function formatAlertTitle(alert: DashboardAlertEvent): string {
  return ALERT_TYPE_LABELS[alert.type] ?? alert.type;
}

export function formatAlertDescription(alert: DashboardAlertEvent): string {
  const group = `Groupe ${alert.groupNumber}`;
  const hole = `trou ${alert.currentHole}`;

  switch (alert.type) {
    case "pace_warning":
      return `${group} est en retard au ${hole}`;
    case "pace_critical":
      return `${group} est très en retard au ${hole}`;
    case "gap_warning":
      return `Ecart important derrière le ${group} au ${hole}`;
    case "bottleneck":
      return `Bouchon causé par le ${group} au ${hole}`;
    case "reminder_sent":
      return `Rappel envoyé au ${group}`;
    default:
      return `${group} — ${hole}`;
  }
}

export function formatAlertSeverity(severity: string): string {
  return SEVERITY_LABELS[severity] ?? severity;
}

export function formatAlertTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
