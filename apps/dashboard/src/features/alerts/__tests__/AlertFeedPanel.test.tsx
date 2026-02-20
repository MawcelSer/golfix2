import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardAlertEvent } from "@golfix/shared";
import { AlertFeedPanel } from "../AlertFeedPanel";

afterEach(cleanup);

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

describe("AlertFeedPanel", () => {
  it("shows empty message when no alerts", () => {
    render(<AlertFeedPanel alerts={[]} />);
    expect(screen.getByText("Aucune alerte")).toBeInTheDocument();
  });

  it("renders alert cards", () => {
    const alerts = [
      makeAlert({ timestamp: "2026-02-20T14:30:00Z" }),
      makeAlert({ timestamp: "2026-02-20T14:35:00Z", type: "bottleneck" }),
    ];
    render(<AlertFeedPanel alerts={alerts} />);

    const cards = screen.getAllByTestId("alert-card");
    expect(cards).toHaveLength(2);
  });

  it("filters by severity", async () => {
    const user = userEvent.setup();
    const alerts = [
      makeAlert({ severity: "warning", timestamp: "2026-02-20T14:30:00Z" }),
      makeAlert({ severity: "critical", timestamp: "2026-02-20T14:31:00Z" }),
      makeAlert({ severity: "info", timestamp: "2026-02-20T14:32:00Z" }),
    ];
    render(<AlertFeedPanel alerts={alerts} />);

    // Initially shows all
    expect(screen.getAllByTestId("alert-card")).toHaveLength(3);

    // Filter to critical only
    await user.click(screen.getByTestId("filter-critical"));
    expect(screen.getAllByTestId("alert-card")).toHaveLength(1);
    expect(screen.getByTestId("alert-card")).toHaveAttribute("data-severity", "critical");

    // Filter back to all
    await user.click(screen.getByTestId("filter-all"));
    expect(screen.getAllByTestId("alert-card")).toHaveLength(3);
  });

  it("shows empty message when filter matches no alerts", async () => {
    const user = userEvent.setup();
    const alerts = [makeAlert({ severity: "warning", timestamp: "2026-02-20T14:30:00Z" })];
    render(<AlertFeedPanel alerts={alerts} />);

    await user.click(screen.getByTestId("filter-critical"));
    expect(screen.getByText("Aucune alerte")).toBeInTheDocument();
  });
});
