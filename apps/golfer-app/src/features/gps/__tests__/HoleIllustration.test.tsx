import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HoleIllustration } from "../HoleIllustration";

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
        greenFront={null}
        greenBack={null}
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
        greenFront={null}
        greenBack={null}
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
        greenFront={null}
        greenBack={null}
        hazards={[]}
        playerPosition={null}
        distanceToCenter={null}
      />,
    );
    expect(screen.getByText("Trou 1")).toBeInTheDocument();
  });
});
