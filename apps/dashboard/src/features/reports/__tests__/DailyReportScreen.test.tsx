import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DailyReportScreen } from "../DailyReportScreen";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
  ApiError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockReport = {
  date: "2026-02-20",
  courseId: "course-1",
  rounds: { total: 24, completed: 20, avgDurationMinutes: 245 },
  sessions: { total: 80, active: 12, finished: 68 },
  paceEvents: {
    total: 5,
    byType: { behind_pace: 3, reminder_sent: 2 },
    bySeverity: { warning: 3, info: 2 },
  },
  interventions: 2,
};

function renderPage(courseId = "course-1") {
  return render(
    <MemoryRouter initialEntries={[`/reports/${courseId}`]}>
      <Routes>
        <Route path="/reports/:courseId" element={<DailyReportScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DailyReportScreen", () => {
  beforeEach(async () => {
    const { apiClient } = await import("@/services/api-client");
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockReport);
  });

  it("shows loading state initially", () => {
    renderPage();
    expect(screen.getByText("Chargement du rapport...")).toBeInTheDocument();
  });

  it("renders stat cards after loading", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("24")).toBeInTheDocument(); // total rounds
    });

    expect(screen.getByText("20")).toBeInTheDocument(); // completed
    expect(screen.getByText("245 min")).toBeInTheDocument(); // avg duration
    // "2" appears in multiple places (interventions + pace event counts)
    expect(screen.getByText("Interventions")).toBeInTheDocument();
  });

  it("renders sessions section", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Sessions")).toBeInTheDocument();
    });

    expect(screen.getByText("80")).toBeInTheDocument(); // total sessions
    expect(screen.getByText("68")).toBeInTheDocument(); // finished
  });

  it("renders pace events breakdown", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Evenements de rythme/)).toBeInTheDocument();
    });

    expect(screen.getByText("behind_pace")).toBeInTheDocument();
    expect(screen.getByText("reminder_sent")).toBeInTheDocument();
  });

  it("has a date picker", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("date-picker")).toBeInTheDocument();
    });
  });

  it("shows error when API fails", async () => {
    const { apiClient, ApiError } = await import("@/services/api-client");
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError("Forbidden", 403));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Forbidden")).toBeInTheDocument();
    });
  });
});
