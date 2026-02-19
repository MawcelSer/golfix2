import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatToggle } from "../StatToggle";

afterEach(cleanup);

describe("StatToggle", () => {
  it("renders neutral state when value is null", () => {
    render(<StatToggle label="FIR" value={null} onChange={vi.fn()} />);

    expect(screen.getByText("FIR")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders Oui when value is true", () => {
    render(<StatToggle label="FIR" value={true} onChange={vi.fn()} />);

    expect(screen.getByText("Oui")).toBeInTheDocument();
  });

  it("renders Non when value is false", () => {
    render(<StatToggle label="FIR" value={false} onChange={vi.fn()} />);

    expect(screen.getByText("Non")).toBeInTheDocument();
  });

  it("cycles null → true on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<StatToggle label="FIR" value={null} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("cycles true → false on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<StatToggle label="FIR" value={true} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("cycles false → null on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<StatToggle label="FIR" value={false} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("has correct aria-label", () => {
    render(<StatToggle label="GIR" value={true} onChange={vi.fn()} />);

    expect(screen.getByLabelText("GIR : Oui")).toBeInTheDocument();
  });
});
