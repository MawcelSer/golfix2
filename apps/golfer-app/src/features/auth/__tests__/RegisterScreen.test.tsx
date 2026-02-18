import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RegisterScreen } from "../RegisterScreen";
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

describe("RegisterScreen", () => {
  test("renders name, email, and password fields", () => {
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/nom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
  });

  test("renders register button", () => {
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /créer/i })).toBeInTheDocument();
  });

  test("calls API and stores auth on successful register", async () => {
    const { apiClient } = await import("@/services/api-client");
    vi.mocked(apiClient.post).mockResolvedValue({
      user: { id: "u1", displayName: "Marcel", email: "m@m.com" },
      accessToken: "at",
      refreshToken: "rt",
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/nom/i), "Marcel");
    await user.type(screen.getByLabelText(/email/i), "m@m.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "password123");
    await user.click(screen.getByRole("button", { name: /créer/i }));

    expect(apiClient.post).toHaveBeenCalledWith("/auth/register", {
      displayName: "Marcel",
      email: "m@m.com",
      password: "password123",
    });
    expect(useAuthStore.getState().user?.displayName).toBe("Marcel");
  });
});
