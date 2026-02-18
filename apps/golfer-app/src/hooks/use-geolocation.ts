import { useCallback, useRef, useState } from "react";

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export type GeoError = "permission_denied" | "position_unavailable" | "timeout";

interface GeolocationState {
  position: GpsPosition | null;
  error: GeoError | null;
  watching: boolean;
  startWatching: () => void;
  stopWatching: () => void;
}

function codeToError(code: number): GeoError {
  switch (code) {
    case 1:
      return "permission_denied";
    case 2:
      return "position_unavailable";
    default:
      return "timeout";
  }
}

export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const startWatching = useCallback(() => {
    if (watchIdRef.current !== null) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
      },
      (err) => {
        setError(codeToError(err.code));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    watchIdRef.current = id;
    setWatching(true);
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }, []);

  return { position, error, watching, startWatching, stopWatching };
}
