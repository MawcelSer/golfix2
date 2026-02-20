import { useRef } from "react";
import Map, { Marker } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import type { DashboardGroupUpdate } from "@golfix/shared";
import { MAPBOX_TOKEN } from "@/lib/constants";
import { GroupMarkers, PACE_COLORS } from "./GroupMarkers";
import { HolePins } from "./HolePins";
import "mapbox-gl/dist/mapbox-gl.css";

interface HolePin {
  holeNumber: number;
  greenCenter: { x: number; y: number } | null;
}

interface CourseMapProps {
  groups: DashboardGroupUpdate[];
  holes: HolePin[];
  centerLat?: number;
  centerLng?: number;
}

export function CourseMap({ groups, holes, centerLat = 48.85, centerLng = 2.35 }: CourseMapProps) {
  const mapRef = useRef<MapRef>(null);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-pine/80">
        <p className="text-cream/40">Carte indisponible — configurez VITE_MAPBOX_TOKEN</p>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        latitude: centerLat,
        longitude: centerLng,
        zoom: 15,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
    >
      {/* Hole pins */}
      {holes
        .filter((h) => h.greenCenter !== null)
        .map((hole) => (
          <Marker
            key={`hole-${hole.holeNumber}`}
            latitude={hole.greenCenter!.y}
            longitude={hole.greenCenter!.x}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-cream/30 bg-pine text-[10px] font-bold text-cream">
              {hole.holeNumber}
            </div>
          </Marker>
        ))}

      {/* Group markers */}
      {groups
        .filter((g) => g.centroid !== null)
        .map((group) => (
          <Marker
            key={`group-${group.groupId}`}
            latitude={group.centroid!.lat}
            longitude={group.centroid!.lng}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg"
              style={{ backgroundColor: PACE_COLORS[group.paceStatus] }}
              title={`Groupe ${group.groupNumber} — Trou ${group.currentHole}`}
            >
              {group.groupNumber}
            </div>
          </Marker>
        ))}
    </Map>
  );
}

export { GroupMarkers, HolePins };
