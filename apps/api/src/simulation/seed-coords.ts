/**
 * Static hole coordinates mirroring seed.ts.
 * Used by the simulation plugin to avoid querying the DB.
 */
export const HOLES_DATA = [
  { num: 1, par: 4, si: 7, dist: 365, lat: 44.8392, lng: -0.581, transition: 1 },
  { num: 2, par: 3, si: 15, dist: 155, lat: 44.84, lng: -0.5798, transition: 1 },
  { num: 3, par: 5, si: 1, dist: 510, lat: 44.841, lng: -0.5785, transition: 2 },
  { num: 4, par: 4, si: 9, dist: 380, lat: 44.8405, lng: -0.577, transition: 1 },
  { num: 5, par: 4, si: 3, dist: 410, lat: 44.8395, lng: -0.5758, transition: 1 },
  { num: 6, par: 3, si: 17, dist: 140, lat: 44.8385, lng: -0.5748, transition: 2 },
  { num: 7, par: 5, si: 5, dist: 490, lat: 44.8375, lng: -0.576, transition: 3 },
  { num: 8, par: 4, si: 11, dist: 340, lat: 44.8365, lng: -0.5775, transition: 1 },
  { num: 9, par: 4, si: 13, dist: 355, lat: 44.8358, lng: -0.579, transition: 2 },
  { num: 10, par: 4, si: 8, dist: 375, lat: 44.837, lng: -0.581, transition: 1 },
  { num: 11, par: 3, si: 16, dist: 165, lat: 44.838, lng: -0.5825, transition: 1 },
  { num: 12, par: 5, si: 2, dist: 520, lat: 44.839, lng: -0.5838, transition: 2 },
  { num: 13, par: 4, si: 10, dist: 350, lat: 44.84, lng: -0.582, transition: 1 },
  { num: 14, par: 4, si: 4, dist: 395, lat: 44.8408, lng: -0.5805, transition: 1 },
  { num: 15, par: 3, si: 18, dist: 130, lat: 44.8398, lng: -0.579, transition: 1 },
  { num: 16, par: 5, si: 6, dist: 505, lat: 44.8388, lng: -0.5778, transition: 2 },
  { num: 17, par: 4, si: 12, dist: 360, lat: 44.8378, lng: -0.5795, transition: 1 },
  { num: 18, par: 4, si: 14, dist: 370, lat: 44.8368, lng: -0.5808, transition: 1 },
] as const;

export const COURSE_NAME = "Golf de Bordeaux-Lac (Test)";
export const COURSE_SLUG = "bordeaux-lac-test";
