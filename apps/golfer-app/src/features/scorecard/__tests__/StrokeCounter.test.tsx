import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrokeCounter } from "../StrokeCounter";

afterEach(cleanup);

describe("StrokeCounter", () => {
  it("renders label and value", () => {
    render(<StrokeCounter label="Coups" value={4} min={1} max={20} onChange={vi.fn()} />);

    expect(screen.getByText("Coups")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("calls onChange with incremented value on plus click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<StrokeCounter label="Coups" value={4} min={1} max={20} onChange={onChange} />);

    await user.click(screen.getByLabelText("Augmenter Coups"));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("calls onChange with decremented value on minus click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<StrokeCounter label="Coups" value={4} min={1} max={20} onChange={onChange} />);

    await user.click(screen.getByLabelText("Diminuer Coups"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("disables minus button at min", () => {
    render(<StrokeCounter label="Coups" value={1} min={1} max={20} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Diminuer Coups")).toBeDisabled();
  });

  it("disables plus button at max", () => {
    render(<StrokeCounter label="Coups" value={20} min={1} max={20} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Augmenter Coups")).toBeDisabled();
  });

  it("enables both buttons when value is between min and max", () => {
    render(<StrokeCounter label="Coups" value={5} min={1} max={20} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Diminuer Coups")).toBeEnabled();
    expect(screen.getByLabelText("Augmenter Coups")).toBeEnabled();
  });
});
