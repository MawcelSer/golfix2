import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";

// Mutable scores map for the mock
const mockScores = new Map<number, Record<string, unknown>>();
const mockSetStrokes = vi.fn();
const mockSetPutts = vi.fn();
const mockToggleFairwayHit = vi.fn();
const mockToggleGir = vi.fn();

vi.mock("@/stores/round-store", () => ({
  useRoundStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      scores: mockScores,
      setStrokes: mockSetStrokes,
      setPutts: mockSetPutts,
      toggleFairwayHit: mockToggleFairwayHit,
      toggleGir: mockToggleGir,
    }),
  ),
}));

const { ScoreEntry } = await import("../ScoreEntry");

function setHoleScore(hole: number, strokes: number, putts = 0) {
  mockScores.set(hole, {
    strokes,
    putts,
    fairwayHit: null,
    greenInRegulation: null,
    synced: false,
  });
}

describe("ScoreEntry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockScores.clear();
    setHoleScore(1, 4);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders strokes and putts counters", () => {
    render(<ScoreEntry holeNumber={1} par={4} holesCount={18} onAdvance={vi.fn()} />);

    expect(screen.getByText("Coups")).toBeInTheDocument();
    expect(screen.getByText("Putts")).toBeInTheDocument();
    expect(screen.getByText("Par 4")).toBeInTheDocument();
  });

  it("shows FIR toggle for par 4+ holes", () => {
    render(<ScoreEntry holeNumber={1} par={4} holesCount={18} onAdvance={vi.fn()} />);

    expect(screen.getByText("FIR")).toBeInTheDocument();
    expect(screen.getByText("GIR")).toBeInTheDocument();
  });

  it("hides FIR toggle for par 3 holes", () => {
    render(<ScoreEntry holeNumber={1} par={3} holesCount={18} onAdvance={vi.fn()} />);

    expect(screen.queryByText("FIR")).not.toBeInTheDocument();
    expect(screen.getByText("GIR")).toBeInTheDocument();
  });

  it("calls setStrokes on stroke change", () => {
    render(<ScoreEntry holeNumber={1} par={4} holesCount={18} onAdvance={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Augmenter Coups"));
    expect(mockSetStrokes).toHaveBeenCalledWith(1, 5);
  });

  it("calls setPutts on putts change", () => {
    render(<ScoreEntry holeNumber={1} par={4} holesCount={18} onAdvance={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Augmenter Putts"));
    expect(mockSetPutts).toHaveBeenCalledWith(1, 1);
  });

  it("auto-advances after 1.5s of inactivity", () => {
    const onAdvance = vi.fn();
    render(<ScoreEntry holeNumber={1} par={4} holesCount={18} onAdvance={onAdvance} />);

    fireEvent.click(screen.getByLabelText("Augmenter Coups"));
    expect(onAdvance).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("does not auto-advance on last hole", () => {
    setHoleScore(18, 4);
    const onAdvance = vi.fn();

    render(<ScoreEntry holeNumber={18} par={4} holesCount={18} onAdvance={onAdvance} />);

    fireEvent.click(screen.getByLabelText("Augmenter Coups"));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("resets auto-advance timer on further interaction", () => {
    const onAdvance = vi.fn();
    render(<ScoreEntry holeNumber={1} par={4} holesCount={18} onAdvance={onAdvance} />);

    // First stroke change starts timer
    fireEvent.click(screen.getByLabelText("Augmenter Coups"));

    // Wait 1s, then change putts — resets timer
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByLabelText("Augmenter Putts"));

    // At 1s after putts change, should not have advanced yet
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onAdvance).not.toHaveBeenCalled();

    // At 1.5s after putts change, should advance
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("returns null when no score exists for hole", () => {
    const { container } = render(
      <ScoreEntry holeNumber={99} par={4} holesCount={18} onAdvance={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });
});
