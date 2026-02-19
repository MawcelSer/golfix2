import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthUser } from "@golfix/shared";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockUser: AuthUser | null = null;
const mockLogout = vi.fn();

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ user: mockUser, logout: mockLogout }),
  ),
}));

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock("@/services/api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
  ApiError: class extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

const { ProfileScreen } = await import("../ProfileScreen");

function renderProfile() {
  return render(
    <MemoryRouter>
      <ProfileScreen />
    </MemoryRouter>,
  );
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "u1", displayName: "Jean Dupont", email: "jean@test.com" };
    mockGet.mockResolvedValue({ notificationPrefs: { pace_reminders: true } });
    mockPatch.mockResolvedValue({ notificationPrefs: { pace_reminders: false } });
  });

  afterEach(cleanup);

  it("shows user display name", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    });
  });

  it("loads and shows notification preference", async () => {
    renderProfile();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/users/me/preferences");
    });
  });

  it("toggles pace reminders on click and updates UI optimistically", async () => {
    renderProfile();

    // Wait for preferences to load
    await waitFor(() => {
      expect(screen.getByRole("switch")).not.toBeDisabled();
    });

    // Verify initial state
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("switch"));

    // Optimistic UI update: aria-checked flips immediately
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("/users/me/preferences", {
        paceReminders: false,
      });
    });
  });

  it("reverts toggle on PATCH failure", async () => {
    mockPatch.mockRejectedValue(new Error("Network error"));

    renderProfile();

    // Wait for preferences to load
    await waitFor(() => {
      expect(screen.getByRole("switch")).not.toBeDisabled();
    });

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("switch"));

    // Optimistic: flips to false
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    // After rejection: reverts to true
    await waitFor(() => {
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });
  });

  it("disables toggle while loading preferences", () => {
    // Don't resolve the get call
    mockGet.mockReturnValue(new Promise(() => {}));

    renderProfile();

    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("calls logout and navigates on logout click", () => {
    renderProfile();

    fireEvent.click(screen.getByText("Se déconnecter"));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
