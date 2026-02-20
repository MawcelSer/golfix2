import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HoleIllustration, toMeters } from "../HoleIllustration";

describe("HoleIllustration", () => {
  afterEach(cleanup);

  it("renders SVG with fairway and green", () => {
    render(
      <HoleIllustration
        holeNumber={7}
        par={4}
        distanceMeters={385}
        teePosition={{ lat: 48.85, lng: 2.29 }}
        greenCenter={{ lat: 48.854, lng: 2.293 }}
        hazards={[]}
        playerPosition={{ lat: 48.852, lng: 2.291 }}
        distanceToCenter={142}
      />,
    );
    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(screen.getByText("142m")).toBeInTheDocument();
  });

  it("renders without player position", () => {
    render(
      <HoleIllustration
        holeNumber={1}
        par={4}
        distanceMeters={350}
        teePosition={{ lat: 48.85, lng: 2.29 }}
        greenCenter={{ lat: 48.854, lng: 2.293 }}
        hazards={[]}
        playerPosition={null}
        distanceToCenter={null}
      />,
    );
    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders fallback when no tee/green positions", () => {
    render(
      <HoleIllustration
        holeNumber={1}
        par={4}
        distanceMeters={350}
        teePosition={null}
        greenCenter={null}
        hazards={[]}
        playerPosition={null}
        distanceToCenter={null}
      />,
    );
    expect(screen.getByText("Trou 1")).toBeInTheDocument();
  });
});

describe("toMeters projection", () => {
  it("produces correct meters at equator", () => {
    const result = toMeters({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0.001 });
    // 0.001° lat ≈ 111.32m, 0.001° lng at equator ≈ 111.32m
    expect(result.dy).toBeCloseTo(111.32, 0);
    expect(result.dx).toBeCloseTo(111.32, 0);
  });

  it("compresses longitude at high latitude (60°N)", () => {
    const result = toMeters({ lat: 60, lng: 10 }, { lat: 60, lng: 10.001 });
    // At 60°N, cos(60°) = 0.5, so dx ≈ 111.32 * 0.5 ≈ 55.66m
    expect(result.dx).toBeCloseTo(55.66, 0);
    expect(result.dy).toBeCloseTo(0, 1);
  });

  it("same point returns zero", () => {
    const result = toMeters({ lat: 48.85, lng: 2.29 }, { lat: 48.85, lng: 2.29 });
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });
});
