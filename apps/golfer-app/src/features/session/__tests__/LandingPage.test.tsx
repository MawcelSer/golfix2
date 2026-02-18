import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "../LandingPage";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: () => ({
    position: { lat: 48.8566, lng: 2.3522, accuracy: 10 },
    error: null,
    watching: false,
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  useAuthStore.getState().reset();
  useAuthStore.getState().setAuth({
    user: { id: "u1", displayName: "Test", email: "t@t.com" },
    accessToken: "at",
    refreshToken: "rt",
  });
  vi.clearAllMocks();
});

describe("LandingPage", () => {
  test("renders welcome message", async () => {
    const { apiClient } = await import("@/services/api-client");
    vi.mocked(apiClient.get).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/bienvenue/i)).toBeInTheDocument();
  });

  test("renders start button", async () => {
    const { apiClient } = await import("@/services/api-client");
    vi.mocked(apiClient.get).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /démarrer/i })).toBeInTheDocument();
  });

  test("displays past rounds when available", async () => {
    const { apiClient } = await import("@/services/api-client");
    vi.mocked(apiClient.get).mockResolvedValue([
      {
        id: "r1",
        userId: "u1",
        courseId: "c1",
        sessionId: null,
        status: "finished",
        startedAt: "2026-02-18T10:00:00Z",
        finishedAt: "2026-02-18T14:00:00Z",
        totalScore: 82,
        totalPutts: 32,
        computedTotalStrokes: 82,
      },
    ]);

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("82")).toBeInTheDocument();
    });
  });

  test("shows off-course message when locate fails", async () => {
    const { apiClient } = await import("@/services/api-client");
    vi.mocked(apiClient.get).mockResolvedValue([]);
    vi.mocked(apiClient.post).mockResolvedValue(null);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    // Need GDPR consent for the button to work
    useAuthStore.getState().acceptGdpr();

    await user.click(screen.getByRole("button", { name: /démarrer/i }));

    await waitFor(() => {
      expect(screen.getByText(/pas sur un parcours/i)).toBeInTheDocument();
    });
  });
});
