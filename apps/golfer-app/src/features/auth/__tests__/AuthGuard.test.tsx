import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthGuard } from "../AuthGuard";
import { useAuthStore } from "@/stores/auth-store";

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().reset();
});

function TestApp({ initialRoute }: { initialRoute: string }) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/gps" element={<div>GPS Screen</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthGuard", () => {
  test("redirects to /login when not authenticated", () => {
    render(<TestApp initialRoute="/gps" />);
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("GPS Screen")).not.toBeInTheDocument();
  });

  test("renders children when authenticated", () => {
    useAuthStore.getState().setAuth({
      user: { id: "u1", displayName: "Test", email: null },
      accessToken: "at",
      refreshToken: "rt",
    });

    render(<TestApp initialRoute="/gps" />);
    expect(screen.getByText("GPS Screen")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });

  test("renders nothing when store has not hydrated", () => {
    // Temporarily mock hasHydrated to return false
    const originalHasHydrated = useAuthStore.persist.hasHydrated;
    useAuthStore.persist.hasHydrated = () => false;

    const { container } = render(<TestApp initialRoute="/gps" />);
    // Should render nothing — no redirect, no content
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    expect(screen.queryByText("GPS Screen")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");

    useAuthStore.persist.hasHydrated = originalHasHydrated;
  });
});
