import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AnonymousScreen } from "../AnonymousScreen";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

afterEach(cleanup);

beforeEach(() => {
  useAuthStore.getState().reset();
  vi.clearAllMocks();
});

describe("AnonymousScreen", () => {
  test("renders display name field", () => {
    render(
      <MemoryRouter>
        <AnonymousScreen />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/nom/i)).toBeInTheDocument();
  });

  test("renders continue button", () => {
    render(
      <MemoryRouter>
        <AnonymousScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /continuer/i })).toBeInTheDocument();
  });

  test("calls API with generated deviceId and stores auth", async () => {
    const { apiClient } = await import("@/services/api-client");
    vi.mocked(apiClient.post).mockResolvedValue({
      user: { id: "u1", displayName: "Joueur", email: null },
      accessToken: "at",
      refreshToken: "rt",
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AnonymousScreen />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/nom/i), "Joueur");
    await user.click(screen.getByRole("button", { name: /continuer/i }));

    expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/anonymous",
      expect.objectContaining({
        displayName: "Joueur",
        deviceId: expect.any(String),
      }),
    );
    expect(useAuthStore.getState().user?.displayName).toBe("Joueur");
  });
});
