import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginScreen } from "../LoginScreen";
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

describe("LoginScreen", () => {
  test("renders email and password fields", () => {
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
  });

  test("renders login button", () => {
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /connexion/i })).toBeInTheDocument();
  });

  test("renders link to register", () => {
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText(/créer un compte/i)).toBeInTheDocument();
  });

  test("calls API and stores auth on successful login", async () => {
    const { apiClient } = await import("@/services/api-client");
    vi.mocked(apiClient.post).mockResolvedValue({
      user: { id: "u1", displayName: "Test", email: "t@t.com" },
      accessToken: "at",
      refreshToken: "rt",
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "t@t.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "password123");
    await user.click(screen.getByRole("button", { name: /connexion/i }));

    expect(apiClient.post).toHaveBeenCalledWith("/auth/login", {
      email: "t@t.com",
      password: "password123",
    });
    expect(useAuthStore.getState().user?.email).toBe("t@t.com");
  });

  test("shows error on failed login", async () => {
    const { apiClient } = await import("@/services/api-client");
    vi.mocked(apiClient.post).mockRejectedValue(new Error("Identifiants invalides"));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email/i), "bad@t.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "wrong");
    await user.click(screen.getByRole("button", { name: /connexion/i }));

    expect(await screen.findByText(/identifiants invalides/i)).toBeInTheDocument();
  });
});
