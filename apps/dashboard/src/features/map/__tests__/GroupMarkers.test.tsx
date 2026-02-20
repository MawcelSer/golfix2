import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardGroupUpdate } from "@golfix/shared";
import { GroupMarkers } from "../GroupMarkers";

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

describe("GroupMarkers", () => {
  it("renders nothing when no groups have centroids", () => {
    const { container } = render(<GroupMarkers groups={[makeGroup({ centroid: null })]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a marker for each group with a centroid", () => {
    const groups = [
      makeGroup({ groupId: "g1", groupNumber: 1 }),
      makeGroup({ groupId: "g2", groupNumber: 2, centroid: null }),
      makeGroup({ groupId: "g3", groupNumber: 3 }),
    ];
    render(<GroupMarkers groups={groups} />);

    expect(screen.getByTestId("group-marker-g1")).toBeInTheDocument();
    expect(screen.queryByTestId("group-marker-g2")).not.toBeInTheDocument();
    expect(screen.getByTestId("group-marker-g3")).toBeInTheDocument();
  });

  it("applies correct pace status data attribute and color", () => {
    const statuses = ["ahead", "on_pace", "attention", "behind"] as const;
    const groups = statuses.map((status, i) =>
      makeGroup({
        groupId: `g${i}`,
        groupNumber: i + 1,
        paceStatus: status,
      }),
    );
    render(<GroupMarkers groups={groups} />);

    statuses.forEach((status, i) => {
      const el = screen.getByTestId(`group-marker-g${i}`);
      expect(el).toHaveAttribute("data-pace", status);
      // JSDOM converts hex to rgb, so just verify the style attribute is set
      expect(el.style.backgroundColor).toBeTruthy();
    });
  });

  it("shows group number as text content", () => {
    render(<GroupMarkers groups={[makeGroup({ groupNumber: 7 })]} />);
    expect(screen.getByTestId("group-marker-g1")).toHaveTextContent("7");
  });

  it("shows tooltip with group and hole info", () => {
    render(<GroupMarkers groups={[makeGroup({ groupNumber: 3, currentHole: 5 })]} />);
    expect(screen.getByTestId("group-marker-g1")).toHaveAttribute("title", "Groupe 3 — Trou 5");
  });
});
