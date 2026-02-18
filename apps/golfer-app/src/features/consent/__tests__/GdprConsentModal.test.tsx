import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GdprConsentModal } from "../GdprConsentModal";
import { useAuthStore } from "@/stores/auth-store";

afterEach(cleanup);

beforeEach(() => {
  useAuthStore.getState().reset();
});

describe("GdprConsentModal", () => {
  test("renders when open", () => {
    render(<GdprConsentModal open onClose={() => {}} />);
    expect(screen.getByText("Suivi GPS")).toBeInTheDocument();
  });

  test("does not render when closed", () => {
    render(<GdprConsentModal open={false} onClose={() => {}} />);
    expect(screen.queryByText("Suivi GPS")).not.toBeInTheDocument();
  });

  test("explains GPS tracking purpose", () => {
    render(<GdprConsentModal open onClose={() => {}} />);
    expect(screen.getByText(/position GPS/i)).toBeInTheDocument();
  });

  test("accept button sets GDPR consent in store", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<GdprConsentModal open onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /accepter/i }));

    expect(useAuthStore.getState().gdprConsent).toBe(true);
    expect(useAuthStore.getState().gdprConsentAt).not.toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  test("refuse button calls onClose without setting consent", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<GdprConsentModal open onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /refuser/i }));

    expect(useAuthStore.getState().gdprConsent).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});
