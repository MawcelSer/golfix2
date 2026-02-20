import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CourseListScreen } from "../CourseListScreen";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/services/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));

import { apiClient } from "@/services/api-client";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<CourseListScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CourseListScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByText("Chargement des parcours...")).toBeInTheDocument();
  });

  it("renders course cards on success", async () => {
    mockGet.mockResolvedValue([
      { id: "c1", name: "Golf de Paris", slug: "paris", holesCount: 18, par: 72, role: "owner" },
      { id: "c2", name: "Golf de Lyon", slug: "lyon", holesCount: 9, par: 36, role: "admin" },
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Golf de Paris")).toBeInTheDocument();
    });

    expect(screen.getByText("Golf de Lyon")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows empty state when no courses", async () => {
    mockGet.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Aucun parcours associe a votre compte.")).toBeInTheDocument();
    });
  });

  it("navigates on course click", async () => {
    mockGet.mockResolvedValue([
      { id: "c1", name: "Golf de Paris", slug: "paris", holesCount: 18, par: 72, role: "owner" },
    ]);

    renderScreen();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Golf de Paris")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Golf de Paris"));
    expect(mockNavigate).toHaveBeenCalledWith("/course/c1");
  });

  it("shows error on API failure", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Erreur de chargement")).toBeInTheDocument();
    });
  });
});
