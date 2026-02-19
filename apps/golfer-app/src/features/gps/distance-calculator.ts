import { haversineDistance } from "@golfix/shared";
import type { HoleData } from "@golfix/shared";
import type { GpsPosition } from "@/hooks/use-geolocation";

export interface HoleDistances {
  front: number | null;
  center: number | null;
  back: number | null;
}

/**
 * Compute distances from current GPS position to hole green positions.
 * HoleData positions use { x: lng, y: lat } (Drizzle "xy" mode).
 * haversineDistance takes (lat1, lng1, lat2, lng2).
 */
export function computeHoleDistances(position: GpsPosition, hole: HoleData): HoleDistances {
  return {
    front: hole.greenFront
      ? Math.round(
          haversineDistance(position.lat, position.lng, hole.greenFront.y, hole.greenFront.x),
        )
      : null,
    center: hole.greenCenter
      ? Math.round(
          haversineDistance(position.lat, position.lng, hole.greenCenter.y, hole.greenCenter.x),
        )
      : null,
    back: hole.greenBack
      ? Math.round(
          haversineDistance(position.lat, position.lng, hole.greenBack.y, hole.greenBack.x),
        )
      : null,
  };
}
