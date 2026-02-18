// ── Request types ──────────────────────────────────────────────────

export interface LocateInput {
  lat: number;
  lng: number;
}

// ── Response types ─────────────────────────────────────────────────

export interface HazardData {
  id: string;
  type: string;
  name: string | null;
  carryPoint: { x: number; y: number } | null;
}

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

export interface CourseMatch {
  courseId: string;
  name: string;
  slug: string;
}
