import { describe, it, expect } from "vitest";
import { buildApp } from "../../app";

const BASE = "/api/v1/courses";

// Seed course center (inside boundary)
const INSIDE_POINT = { lat: 44.8378, lng: -0.5792 };
// Point well outside any course boundary
const OUTSIDE_POINT = { lat: 48.8566, lng: 2.3522 }; // Paris

// ── Tests ───────────────────────────────────────────────────────────

describe("Course routes", () => {
  // ── POST /courses/locate ──────────────────────────────────────────

  describe("POST /courses/locate", () => {
    it("returns course info when point is inside boundary (200)", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/locate`,
        payload: INSIDE_POINT,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.courseId).toBeDefined();
      expect(body.name).toBe("Golf de Bordeaux-Lac (Test)");
      expect(body.slug).toBe("bordeaux-lac-test");

      await app.close();
    });

    it("returns 404 when point is outside all boundaries", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/locate`,
        payload: OUTSIDE_POINT,
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe("No course found at this location");

      await app.close();
    });

    it("returns 400 for invalid body", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: `${BASE}/locate`,
        payload: { lat: "not-a-number", lng: 999 },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBeDefined();
      expect(body.statusCode).toBe(400);

      await app.close();
    });
  });

  // ── GET /courses/:slug/data ───────────────────────────────────────

  describe("GET /courses/:slug/data", () => {
    it("returns full course with 18 holes (200)", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/bordeaux-lac-test/data`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      // Course fields
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Golf de Bordeaux-Lac (Test)");
      expect(body.slug).toBe("bordeaux-lac-test");
      expect(body.holesCount).toBe(18);
      expect(body.par).toBe(72);
      expect(body.paceTargetMinutes).toBe(255);
      expect(body.teeIntervalMinutes).toBe(8);
      expect(body.timezone).toBe("Europe/Paris");
      expect(body.dataVersion).toBe(1);

      // Holes
      expect(body.holes).toHaveLength(18);

      // Verify holes are ordered by number
      for (let i = 0; i < 18; i++) {
        expect(body.holes[i].holeNumber).toBe(i + 1);
      }

      // Check first hole structure
      const hole1 = body.holes[0];
      expect(hole1.id).toBeDefined();
      expect(hole1.par).toBe(4);
      expect(hole1.strokeIndex).toBe(7);
      expect(hole1.distanceMeters).toBe(365);
      expect(hole1.teePosition).toBeDefined();
      expect(hole1.greenCenter).toBeDefined();
      expect(hole1.greenFront).toBeDefined();
      expect(hole1.greenBack).toBeDefined();

      // Check that par-4+ holes have hazards
      const holesWithHazards = body.holes.filter(
        (h: { hazards: unknown[] }) => h.hazards.length > 0,
      );
      expect(holesWithHazards.length).toBeGreaterThan(0);

      // Check hazard structure
      const hazard = holesWithHazards[0].hazards[0];
      expect(hazard.id).toBeDefined();
      expect(hazard.type).toBeDefined();

      await app.close();
    });

    it("returns 404 for unknown slug", async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: "GET",
        url: `${BASE}/unknown-slug/data`,
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe("Course not found");

      await app.close();
    });
  });
});
