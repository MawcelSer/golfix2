import { describe, expect, test, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomTabs } from "../BottomTabs";

afterEach(cleanup);

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <BottomTabs />
    </MemoryRouter>,
  );
}

describe("BottomTabs", () => {
  test("renders 3 navigation tabs", () => {
    const { container } = renderWithRouter();
    const nav = container.querySelector("nav")!;
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(3);
  });

  test("renders GPS, Carte, and Profil labels", () => {
    renderWithRouter();
    expect(screen.getByText("GPS")).toBeInTheDocument();
    expect(screen.getByText("Carte")).toBeInTheDocument();
    expect(screen.getByText("Profil")).toBeInTheDocument();
  });

  test("GPS tab links to /gps", () => {
    renderWithRouter();
    const gpsLink = screen.getByText("GPS").closest("a");
    expect(gpsLink).toHaveAttribute("href", "/gps");
  });

  test("Carte tab links to /scorecard", () => {
    renderWithRouter();
    const carteLink = screen.getByText("Carte").closest("a");
    expect(carteLink).toHaveAttribute("href", "/scorecard");
  });

  test("Profil tab links to /profile", () => {
    renderWithRouter();
    const profilLink = screen.getByText("Profil").closest("a");
    expect(profilLink).toHaveAttribute("href", "/profile");
  });
});
