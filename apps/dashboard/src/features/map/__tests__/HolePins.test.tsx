import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HolePins } from "../HolePins";

afterEach(cleanup);

describe("HolePins", () => {
  it("renders nothing when no holes have green centers", () => {
    const holes = [
      { holeNumber: 1, greenCenter: null },
      { holeNumber: 2, greenCenter: null },
    ];
    const { container } = render(<HolePins holes={holes} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a pin for each hole with a green center", () => {
    const holes = [
      { holeNumber: 1, greenCenter: { x: 2.35, y: 48.85 } },
      { holeNumber: 2, greenCenter: null },
      { holeNumber: 3, greenCenter: { x: 2.36, y: 48.86 } },
    ];
    render(<HolePins holes={holes} />);

    expect(screen.getByTestId("hole-pin-1")).toBeInTheDocument();
    expect(screen.queryByTestId("hole-pin-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("hole-pin-3")).toBeInTheDocument();
  });

  it("displays hole number as text content", () => {
    const holes = [{ holeNumber: 9, greenCenter: { x: 2.35, y: 48.85 } }];
    render(<HolePins holes={holes} />);
    expect(screen.getByTestId("hole-pin-9")).toHaveTextContent("9");
  });

  it("shows tooltip with hole number", () => {
    const holes = [{ holeNumber: 5, greenCenter: { x: 2.35, y: 48.85 } }];
    render(<HolePins holes={holes} />);
    expect(screen.getByTestId("hole-pin-5")).toHaveAttribute("title", "Trou 5");
  });

  it("renders all 18 holes when all have positions", () => {
    const holes = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      greenCenter: { x: 2.35 + i * 0.001, y: 48.85 + i * 0.001 },
    }));
    render(<HolePins holes={holes} />);

    for (let i = 1; i <= 18; i++) {
      expect(screen.getByTestId(`hole-pin-${i}`)).toBeInTheDocument();
    }
  });
});
