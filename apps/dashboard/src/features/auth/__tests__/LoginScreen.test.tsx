import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginScreen } from "../LoginScreen";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    post: vi.fn(),
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

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ setAuth: vi.fn(), user: null, accessToken: null }),
    { getState: () => ({ accessToken: null }) },
  ),
}));

import { apiClient } from "@/services/api-client";

const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginScreen />
    </MemoryRouter>,
  );
}

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form", () => {
    renderLogin();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connexion" })).toBeInTheDocument();
  });

  it("shows validation error for short password", async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Mot de passe"), "short");
    await user.click(screen.getByRole("button", { name: "Connexion" }));

    expect(screen.getByText("8 caracteres minimum")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("calls API on valid submit", async () => {
    mockPost.mockResolvedValue({
      user: { id: "u1", displayName: "Manager", email: "test@test.com" },
      accessToken: "at",
      refreshToken: "rt",
    });

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Mot de passe"), "password123");
    await user.click(screen.getByRole("button", { name: "Connexion" }));

    expect(mockPost).toHaveBeenCalledWith("/auth/login", {
      email: "test@test.com",
      password: "password123",
    });
  });

  it("shows error on failed login", async () => {
    mockPost.mockRejectedValue(new Error("Invalid credentials"));

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Mot de passe"), "password123");
    await user.click(screen.getByRole("button", { name: "Connexion" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });
});
