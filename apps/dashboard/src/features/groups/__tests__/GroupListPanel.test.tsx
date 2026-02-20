import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardGroupUpdate } from "@golfix/shared";
import { GroupListPanel } from "../GroupListPanel";

afterEach(cleanup);

function makeGroup(overrides: Partial<DashboardGroupUpdate> = {}): DashboardGroupUpdate {
  return {
    groupId: "g1",
    groupNumber: 1,
    currentHole: 3,
    paceStatus: "on_pace",
    paceFactor: 1.0,
    sessions: ["s1", "s2"],
    projectedFinish: null,
    centroid: { lat: 48.85, lng: 2.35 },
    ...overrides,
  };
}

describe("GroupListPanel", () => {
  it("shows empty message when no groups", () => {
    render(<GroupListPanel groups={[]} />);
    expect(screen.getByText("Aucun groupe actif")).toBeInTheDocument();
  });

  it("renders a row for each group", () => {
    const groups = [
      makeGroup({ groupId: "g1", groupNumber: 1 }),
      makeGroup({ groupId: "g2", groupNumber: 2 }),
      makeGroup({ groupId: "g3", groupNumber: 3 }),
    ];
    render(<GroupListPanel groups={groups} />);

    expect(screen.getByTestId("group-row-g1")).toBeInTheDocument();
    expect(screen.getByTestId("group-row-g2")).toBeInTheDocument();
    expect(screen.getByTestId("group-row-g3")).toBeInTheDocument();
  });

  it("shows group number, current hole, and player count", () => {
    const groups = [
      makeGroup({ groupId: "g1", groupNumber: 5, currentHole: 9, sessions: ["a", "b", "c"] }),
    ];
    render(<GroupListPanel groups={groups} />);

    const row = screen.getByTestId("group-row-g1");
    expect(row).toHaveTextContent("5");
    expect(row).toHaveTextContent("9");
    expect(row).toHaveTextContent("3");
  });

  it("sorts by pace status when clicking the status column header", async () => {
    const user = userEvent.setup();
    const groups = [
      makeGroup({ groupId: "g1", groupNumber: 1, paceStatus: "on_pace" }),
      makeGroup({ groupId: "g2", groupNumber: 2, paceStatus: "behind" }),
      makeGroup({ groupId: "g3", groupNumber: 3, paceStatus: "ahead" }),
    ];
    render(<GroupListPanel groups={groups} />);

    await user.click(screen.getByTestId("sort-paceStatus"));

    const rows = screen.getAllByTestId(/^group-row-/);
    // behind (0) < attention (1) < on_pace (2) < ahead (3)
    expect(rows[0]).toHaveAttribute("data-testid", "group-row-g2"); // behind
    expect(rows[1]).toHaveAttribute("data-testid", "group-row-g1"); // on_pace
    expect(rows[2]).toHaveAttribute("data-testid", "group-row-g3"); // ahead
  });

  it("displays projected finish time when available", () => {
    const groups = [
      makeGroup({
        groupId: "g1",
        projectedFinish: "2026-02-20T16:30:00.000Z",
      }),
    ];
    render(<GroupListPanel groups={groups} />);

    const row = screen.getByTestId("group-row-g1");
    // Should contain the formatted time (locale-dependent but includes digits)
    expect(row.textContent).toMatch(/\d{2}:\d{2}/);
  });
});
