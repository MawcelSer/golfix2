import { eq, asc, inArray } from "drizzle-orm";
import { db } from "../db/connection";
import { courses, holes, hazards, courseRoles } from "../db/schema/index";
import { isOnCourse, type CourseMatch } from "../spatial/spatial-service";

// ── Types ──────────────────────────────────────────────────────────

export interface HoleData {
  id: string;
  holeNumber: number;
  par: number;
  strokeIndex: number;
  distanceMeters: number;
  teePosition: { x: number; y: number } | null;
  greenCenter: { x: number; y: number } | null;
  greenFront: { x: number; y: number } | null;
  greenBack: { x: number; y: number } | null;
  paceTargetMinutes: number | null;
  transitionMinutes: number;
  hazards: HazardData[];
}

export interface HazardData {
  id: string;
  type: string;
  name: string | null;
  carryPoint: { x: number; y: number } | null;
}

export interface CourseData {
  id: string;
  name: string;
  slug: string;
  holesCount: number;
  par: number;
  paceTargetMinutes: number;
  teeIntervalMinutes: number;
  timezone: string;
  dataVersion: number;
  holes: HoleData[];
}

export interface ManagedCourse {
  id: string;
  name: string;
  slug: string;
  holesCount: number;
  par: number;
  role: string;
}

// ── getManagedCourses ────────────────────────────────────────────────

export async function getManagedCourses(userId: string): Promise<ManagedCourse[]> {
  const rows = await db
    .select({
      id: courses.id,
      name: courses.name,
      slug: courses.slug,
      holesCount: courses.holesCount,
      par: courses.par,
      role: courseRoles.role,
    })
    .from(courseRoles)
    .innerJoin(courses, eq(courseRoles.courseId, courses.id))
    .where(eq(courseRoles.userId, userId));

  return rows;
}

// ── locateCourse ────────────────────────────────────────────────────

/**
 * Determine which course a GPS coordinate falls within.
 *
 * @param lat  Latitude  (WGS-84)
 * @param lng  Longitude (WGS-84)
 * @returns    Course info or null if off-course
 */
export async function locateCourse(lat: number, lng: number): Promise<CourseMatch | null> {
  return isOnCourse(lat, lng);
}

// ── getCourseData ───────────────────────────────────────────────────

/**
 * Fetch full course geodata payload by slug — course info, all holes,
 * and all hazards.
 *
 * @param slug  Course slug
 * @returns     Full course data or null if not found
 */
export async function getCourseData(slug: string): Promise<CourseData | null> {
  // Fetch course (exclude boundary — large polygon not needed by client)
  const courseRows = await db
    .select({
      id: courses.id,
      name: courses.name,
      slug: courses.slug,
      holesCount: courses.holesCount,
      par: courses.par,
      paceTargetMinutes: courses.paceTargetMinutes,
      teeIntervalMinutes: courses.teeIntervalMinutes,
      timezone: courses.timezone,
      dataVersion: courses.dataVersion,
    })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  const course = courseRows[0];
  if (!course) return null;

  // Fetch all holes ordered by hole number
  const holeRows = await db
    .select({
      id: holes.id,
      holeNumber: holes.holeNumber,
      par: holes.par,
      strokeIndex: holes.strokeIndex,
      distanceMeters: holes.distanceMeters,
      teePosition: holes.teePosition,
      greenCenter: holes.greenCenter,
      greenFront: holes.greenFront,
      greenBack: holes.greenBack,
      paceTargetMinutes: holes.paceTargetMinutes,
      transitionMinutes: holes.transitionMinutes,
    })
    .from(holes)
    .where(eq(holes.courseId, course.id))
    .orderBy(asc(holes.holeNumber));

  // Collect all hole IDs to batch-fetch hazards
  const holeIds = holeRows.map((h) => h.id);

  // Fetch all hazards for this course's holes in one query
  let hazardRows: {
    id: string;
    holeId: string;
    type: string;
    name: string | null;
    carryPoint: { x: number; y: number } | null;
  }[] = [];

  if (holeIds.length > 0) {
    hazardRows = await db
      .select({
        id: hazards.id,
        holeId: hazards.holeId,
        type: hazards.type,
        name: hazards.name,
        carryPoint: hazards.carryPoint,
      })
      .from(hazards)
      .where(inArray(hazards.holeId, holeIds));
  }

  // Group hazards by hole ID
  const hazardsByHole = new Map<string, HazardData[]>();
  for (const h of hazardRows) {
    const list = hazardsByHole.get(h.holeId) ?? [];
    list.push({
      id: h.id,
      type: h.type,
      name: h.name,
      carryPoint: h.carryPoint,
    });
    hazardsByHole.set(h.holeId, list);
  }

  // Assemble response
  const holesData: HoleData[] = holeRows.map((h) => ({
    id: h.id,
    holeNumber: h.holeNumber,
    par: h.par,
    strokeIndex: h.strokeIndex,
    distanceMeters: h.distanceMeters,
    teePosition: h.teePosition,
    greenCenter: h.greenCenter,
    greenFront: h.greenFront,
    greenBack: h.greenBack,
    paceTargetMinutes: h.paceTargetMinutes,
    transitionMinutes: h.transitionMinutes,
    hazards: hazardsByHole.get(h.id) ?? [],
  }));

  return {
    id: course.id,
    name: course.name,
    slug: course.slug,
    holesCount: course.holesCount,
    par: course.par,
    paceTargetMinutes: course.paceTargetMinutes,
    teeIntervalMinutes: course.teeIntervalMinutes,
    timezone: course.timezone,
    dataVersion: course.dataVersion,
    holes: holesData,
  };
}
