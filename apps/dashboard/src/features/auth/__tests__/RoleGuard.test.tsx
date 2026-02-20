import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RoleGuard } from "../RoleGuard";

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

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<RoleGuard />}>
          <Route path="/" element={<div>Protected content</div>} />
        </Route>
        <Route path="/unauthorized" element={<div>Unauthorized page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoleGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockGet.mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithRouter();
    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  it("renders children when user has managed courses", async () => {
    mockGet.mockResolvedValue([
      { id: "c1", name: "Test Course", slug: "test", holesCount: 18, par: 72, role: "owner" },
    ]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });
  });

  it("redirects to /unauthorized when no managed courses", async () => {
    mockGet.mockResolvedValue([]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Unauthorized page")).toBeInTheDocument();
    });
  });
});
