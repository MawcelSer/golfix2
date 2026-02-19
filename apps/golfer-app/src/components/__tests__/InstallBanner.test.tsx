import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { InstallBanner } from "../InstallBanner";

describe("InstallBanner", () => {
  const mockOnInstall = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("renders install message and buttons", () => {
    render(<InstallBanner onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    expect(screen.getByText("Installer Golfix")).toBeInTheDocument();
    expect(screen.getByText("Installer")).toBeInTheDocument();
  });

  it("calls onInstall when install button is clicked", () => {
    render(<InstallBanner onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    fireEvent.click(screen.getByText("Installer"));
    expect(mockOnInstall).toHaveBeenCalled();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    render(<InstallBanner onInstall={mockOnInstall} onDismiss={mockOnDismiss} />);

    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
