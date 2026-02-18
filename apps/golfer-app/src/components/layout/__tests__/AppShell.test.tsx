import { describe, expect, test, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../AppShell";

afterEach(cleanup);

describe("AppShell", () => {
  test("renders children and bottom tabs", () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div data-testid="child">content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("GPS")).toBeInTheDocument();
  });
});
