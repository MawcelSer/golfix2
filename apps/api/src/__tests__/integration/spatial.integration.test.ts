import { describe, it, expect } from "vitest";
import { buildApp } from "../../app";

const COURSES_BASE = "/api/v1/courses";

// Seed course: "Golf de Bordeaux-Lac (Test)"
// Boundary: 800 m radius polygon around lat=44.8378, lng=-0.5792
// The center is well inside the polygon.
const INSIDE_POINT = { lat: 44.8378, lng: -0.5792 };

// Null Island (0°, 0°) — guaranteed outside any course boundary
const OCEAN_POINT = { lat: 0, lng: 0 };

// ── Tests ────────────────────────────────────────────────────────────

describe("Spatial integration tests", () => {
  // ── POST /courses/locate — inside boundary → found ───────────────

  it("course locate with seed course coordinates → found", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: `${COURSES_BASE}/locate`,
      payload: INSIDE_POINT,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.courseId).toBeDefined();
    expect(body.name).toBe("Golf de Bordeaux-Lac (Test)");
    expect(body.slug).toBe("bordeaux-lac-test");

    await app.close();
  });

  // ── POST /courses/locate — ocean coordinates → 404 ───────────────

  it("course locate with ocean coordinates (0,0) → 404", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: `${COURSES_BASE}/locate`,
      payload: OCEAN_POINT,
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();
    expect(body.error).toBe("No course found at this location");

    await app.close();
  });

  // ── GET /courses/:slug/data — full geodata ────────────────────────

  it("course geodata endpoint returns full data with 18 holes and geometry", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: `${COURSES_BASE}/bordeaux-lac-test/data`,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    // Top-level course fields
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Golf de Bordeaux-Lac (Test)");
    expect(body.slug).toBe("bordeaux-lac-test");
    expect(body.holesCount).toBe(18);

    // Holes array
    expect(Array.isArray(body.holes)).toBe(true);
    expect(body.holes).toHaveLength(18);

    // Every hole must carry teePosition and greenCenter
    for (const hole of body.holes) {
      expect(hole.teePosition).not.toBeNull();
      expect(hole.teePosition).toBeDefined();
      expect(hole.greenCenter).not.toBeNull();
      expect(hole.greenCenter).toBeDefined();
    }

    await app.close();
  });
});
