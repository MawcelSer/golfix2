import { describe, expect, it } from "vitest";
import type { DashboardAlertEvent } from "@golfix/shared";
import { formatAlertTitle, formatAlertDescription, formatAlertSeverity } from "../format-alert";

function makeAlert(overrides: Partial<DashboardAlertEvent> = {}): DashboardAlertEvent {
  return {
    type: "pace_warning",
    severity: "warning",
    groupId: "g1",
    groupNumber: 3,
    currentHole: 7,
    details: {},
    timestamp: "2026-02-20T14:30:00.000Z",
    ...overrides,
  };
}

describe("formatAlertTitle", () => {
  it("returns French label for known alert types", () => {
    expect(formatAlertTitle(makeAlert({ type: "pace_warning" }))).toBe("Alerte rythme");
    expect(formatAlertTitle(makeAlert({ type: "pace_critical" }))).toBe("Rythme critique");
    expect(formatAlertTitle(makeAlert({ type: "gap_warning" }))).toBe("Ecart important");
    expect(formatAlertTitle(makeAlert({ type: "bottleneck" }))).toBe("Bouchon détecté");
    expect(formatAlertTitle(makeAlert({ type: "reminder_sent" }))).toBe("Rappel envoyé");
  });

  it("returns raw type for unknown alert types", () => {
    expect(formatAlertTitle(makeAlert({ type: "custom_alert" }))).toBe("custom_alert");
  });
});

describe("formatAlertDescription", () => {
  it("describes pace warning with group and hole", () => {
    const desc = formatAlertDescription(
      makeAlert({ type: "pace_warning", groupNumber: 3, currentHole: 7 }),
    );
    expect(desc).toBe("Groupe 3 est en retard au trou 7");
  });

  it("describes bottleneck", () => {
    const desc = formatAlertDescription(
      makeAlert({ type: "bottleneck", groupNumber: 5, currentHole: 12 }),
    );
    expect(desc).toBe("Bouchon causé par le Groupe 5 au trou 12");
  });

  it("describes reminder sent", () => {
    const desc = formatAlertDescription(makeAlert({ type: "reminder_sent", groupNumber: 2 }));
    expect(desc).toBe("Rappel envoyé au Groupe 2");
  });

  it("returns fallback for unknown type", () => {
    const desc = formatAlertDescription(
      makeAlert({ type: "unknown", groupNumber: 1, currentHole: 4 }),
    );
    expect(desc).toBe("Groupe 1 — trou 4");
  });
});

describe("formatAlertSeverity", () => {
  it("returns French label for known severities", () => {
    expect(formatAlertSeverity("info")).toBe("Info");
    expect(formatAlertSeverity("warning")).toBe("Attention");
    expect(formatAlertSeverity("critical")).toBe("Critique");
  });

  it("returns raw value for unknown severity", () => {
    expect(formatAlertSeverity("unknown")).toBe("unknown");
  });
});
