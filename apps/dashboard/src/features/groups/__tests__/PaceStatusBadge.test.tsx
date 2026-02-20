import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaceStatusBadge } from "../PaceStatusBadge";

afterEach(cleanup);

describe("PaceStatusBadge", () => {
  it("renders correct French label for each status", () => {
    const expected: Record<string, string> = {
      ahead: "En avance",
      on_pace: "Dans le temps",
      attention: "Attention",
      behind: "En retard",
    };

    for (const [status, label] of Object.entries(expected)) {
      cleanup();
      render(<PaceStatusBadge status={status as "ahead" | "on_pace" | "attention" | "behind"} />);
      expect(screen.getByTestId("pace-badge")).toHaveTextContent(label);
    }
  });

  it("sets data-status attribute", () => {
    render(<PaceStatusBadge status="behind" />);
    expect(screen.getByTestId("pace-badge")).toHaveAttribute("data-status", "behind");
  });
});
