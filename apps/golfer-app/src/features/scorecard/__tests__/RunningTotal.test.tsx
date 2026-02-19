import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { HoleData } from "@golfix/shared";
import type { LocalScore } from "@/stores/round-store";
import { RunningTotal } from "../RunningTotal";

afterEach(cleanup);

function makeHole(num: number, par: number): HoleData {
  return {
    id: `h${num}`,
    holeNumber: num,
    par,
    strokeIndex: num,
    distanceMeters: 350,
    teePosition: null,
    greenCenter: null,
    greenFront: null,
    greenBack: null,
    paceTargetMinutes: null,
    transitionMinutes: 3,
    hazards: [],
  };
}

function makeScore(strokes: number): LocalScore {
  return { strokes, putts: 0, fairwayHit: null, greenInRegulation: null, synced: true };
}

describe("RunningTotal", () => {
  const holes = [makeHole(1, 4), makeHole(2, 3), makeHole(3, 5)];

  it("shows dash when no scores are entered", () => {
    render(<RunningTotal scores={new Map()} holes={holes} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows total strokes and vs par for played holes", () => {
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(5)); // +1 over par 4
    scores.set(2, makeScore(3)); // even on par 3

    render(<RunningTotal scores={scores} holes={holes} />);

    expect(screen.getByText("8")).toBeInTheDocument(); // total strokes
    expect(screen.getByText("+1")).toBeInTheDocument(); // 8 - 7 = +1
    expect(screen.getByText("2 trous")).toBeInTheDocument();
  });

  it("shows E when even with par", () => {
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(4)); // par
    scores.set(2, makeScore(3)); // par

    render(<RunningTotal scores={scores} holes={holes} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  it("shows negative when under par", () => {
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(3)); // birdie on par 4

    render(<RunningTotal scores={scores} holes={holes} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText("1 trous")).toBeInTheDocument();
  });

  it("only counts holes that have scores", () => {
    const scores = new Map<number, LocalScore>();
    scores.set(1, makeScore(6)); // +2 on par 4
    // hole 2 and 3 not scored

    render(<RunningTotal scores={scores} holes={holes} />);

    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("1 trous")).toBeInTheDocument();
  });
});
