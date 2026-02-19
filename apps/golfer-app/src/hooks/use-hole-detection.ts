import { useCallback, useEffect, useRef, useState } from "react";
import { haversineDistance } from "@golfix/shared";
import type { HoleData } from "@golfix/shared";
import type { GpsPosition } from "./use-geolocation";

const TEE_PROXIMITY_M = 80;
const GREEN_PROXIMITY_M = 30;
const HYSTERESIS_COUNT = 2;
const MANUAL_OVERRIDE_MS = 3 * 60 * 1000; // 3 minutes

interface HoleDetectionResult {
  detectedHole: number;
  nearGreen: boolean;
  setManualHole: (hole: number) => void;
}

function distanceToTee(pos: GpsPosition, hole: HoleData): number | null {
  if (!hole.teePosition) return null;
  return haversineDistance(pos.lat, pos.lng, hole.teePosition.y, hole.teePosition.x);
}

function distanceToGreen(pos: GpsPosition, hole: HoleData): number | null {
  if (!hole.greenCenter) return null;
  return haversineDistance(pos.lat, pos.lng, hole.greenCenter.y, hole.greenCenter.x);
}

export function useHoleDetection(
  position: GpsPosition | null,
  holes: HoleData[],
  defaultHole: number = 1,
): HoleDetectionResult {
  const [detectedHole, setDetectedHole] = useState(defaultHole);
  const [nearGreen, setNearGreen] = useState(false);

  const candidateRef = useRef<number | null>(null);
  const candidateCountRef = useRef(0);
  const manualOverrideRef = useRef<number | null>(null);
  const manualTimestampRef = useRef(0);

  const setManualHole = useCallback((hole: number) => {
    setDetectedHole(hole);
    manualOverrideRef.current = hole;
    manualTimestampRef.current = Date.now();
    candidateRef.current = null;
    candidateCountRef.current = 0;
  }, []);

  useEffect(() => {
    if (!position || holes.length === 0) return;

    // Check manual override timeout
    const isManualActive =
      manualOverrideRef.current !== null &&
      Date.now() - manualTimestampRef.current < MANUAL_OVERRIDE_MS;

    // Find closest tee
    let closestHole: number | null = null;
    let closestDist = Infinity;

    for (const hole of holes) {
      const dist = distanceToTee(position, hole);
      if (dist !== null && dist < closestDist) {
        closestDist = dist;
        closestHole = hole.holeNumber;
      }
    }

    // Only consider if within proximity threshold
    if (closestDist > TEE_PROXIMITY_M) {
      closestHole = null;
    }

    // Hysteresis: require consecutive matches before switching
    if (closestHole !== null && !isManualActive) {
      if (closestHole === candidateRef.current) {
        candidateCountRef.current++;
      } else {
        candidateRef.current = closestHole;
        candidateCountRef.current = 1;
      }

      if (candidateCountRef.current >= HYSTERESIS_COUNT && closestHole !== detectedHole) {
        setDetectedHole(closestHole);
        candidateRef.current = null;
        candidateCountRef.current = 0;
      }
    }

    // Check near green for current hole
    const currentHoleData = holes.find((h) => h.holeNumber === detectedHole);
    if (currentHoleData) {
      const greenDist = distanceToGreen(position, currentHoleData);
      setNearGreen(greenDist !== null && greenDist <= GREEN_PROXIMITY_M);
    }
  }, [position, holes, detectedHole]);

  return { detectedHole, nearGreen, setManualHole };
}
