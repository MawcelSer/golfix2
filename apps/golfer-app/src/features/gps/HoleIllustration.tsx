import type { HazardData } from "@golfix/shared";

interface LatLng {
  lat: number;
  lng: number;
}

interface HoleIllustrationProps {
  holeNumber: number;
  par: number;
  distanceMeters: number;
  teePosition: LatLng | null;
  greenCenter: LatLng | null;
  hazards: HazardData[];
  playerPosition: LatLng | null;
  distanceToCenter: number | null;
}

const SVG_WIDTH = 200;
const SVG_HEIGHT = 400;
const TEE_Y = 360;
const GREEN_Y = 60;
const CENTER_X = 100;
const LATERAL_SCALE = 0.3;

interface MetersXY {
  dx: number;
  dy: number;
}

export function toMeters(origin: LatLng, point: LatLng): MetersXY {
  const dy = (point.lat - origin.lat) * 111320;
  const dx = (point.lng - origin.lng) * 111320 * Math.cos(origin.lat * (Math.PI / 180));
  return { dx, dy };
}

function toSvgY(tee: LatLng, green: LatLng, point: LatLng): number {
  const totalM = toMeters(tee, green);
  const totalDist = Math.sqrt(totalM.dx ** 2 + totalM.dy ** 2);
  if (totalDist === 0) return TEE_Y;
  const pointM = toMeters(tee, point);
  const pointDist = Math.sqrt(pointM.dx ** 2 + pointM.dy ** 2);
  const ratio = Math.min(1, Math.max(0, pointDist / totalDist));
  return TEE_Y - ratio * (TEE_Y - GREEN_Y);
}

function toSvgX(tee: LatLng, green: LatLng, point: LatLng): number {
  const gm = toMeters(tee, green);
  const len = Math.sqrt(gm.dx ** 2 + gm.dy ** 2);
  if (len === 0) return CENTER_X;
  const pm = toMeters(tee, point);
  const cross = (-gm.dy * pm.dx + gm.dx * pm.dy) / len;
  return CENTER_X + cross * LATERAL_SCALE;
}

type HazardWithCarryPoint = HazardData & { carryPoint: { x: number; y: number } };

function hasCarryPoint(h: HazardData): h is HazardWithCarryPoint {
  return h.carryPoint != null;
}

export function HoleIllustration({
  holeNumber,
  par,
  distanceMeters,
  teePosition,
  greenCenter,
  hazards,
  playerPosition,
  distanceToCenter,
}: HoleIllustrationProps) {
  if (!teePosition || !greenCenter) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-cream/5">
        <div className="text-center">
          <p className="font-display text-3xl text-cream">Trou {holeNumber}</p>
          <p className="mt-1 text-sm text-cream/50">
            Par {par} · {distanceMeters}m
          </p>
        </div>
      </div>
    );
  }

  const playerSvgY = playerPosition ? toSvgY(teePosition, greenCenter, playerPosition) : null;
  const playerSvgX = playerPosition ? toSvgX(teePosition, greenCenter, playerPosition) : null;

  const bgId = `bg-grad-${holeNumber}`;
  const glowId = `green-glow-${holeNumber}`;

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="h-full w-full"
      aria-label={`Trou ${holeNumber}`}
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a4a25" />
          <stop offset="100%" stopColor="#0f2818" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5cb85c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#2d8b47" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill={`url(#${bgId})`} />

      {/* Fairway */}
      <path
        d={`M ${CENTER_X - 18} ${TEE_Y} C ${CENTER_X - 28} ${(TEE_Y + GREEN_Y) / 2}, ${CENTER_X - 22} ${GREEN_Y + 40}, ${CENTER_X} ${GREEN_Y + 20} C ${CENTER_X + 22} ${GREEN_Y + 40}, ${CENTER_X + 28} ${(TEE_Y + GREEN_Y) / 2}, ${CENTER_X + 18} ${TEE_Y} Z`}
        fill="#3a7a4a"
        opacity="0.5"
      />

      {/* Green */}
      <ellipse cx={CENTER_X} cy={GREEN_Y} rx={22} ry={14} fill={`url(#${glowId})`} />
      <ellipse cx={CENTER_X} cy={GREEN_Y} rx={16} ry={10} fill="#5cb85c" opacity="0.8" />

      {/* Flag */}
      <line
        x1={CENTER_X}
        y1={GREEN_Y - 18}
        x2={CENTER_X}
        y2={GREEN_Y}
        stroke="#fafdf7"
        strokeWidth="1"
      />
      <polygon
        points={`${CENTER_X},${GREEN_Y - 18} ${CENTER_X + 8},${GREEN_Y - 14} ${CENTER_X},${GREEN_Y - 10}`}
        fill="#d4a843"
      />

      {/* Tee box */}
      <rect
        x={CENTER_X - 8}
        y={TEE_Y - 3}
        width={16}
        height={6}
        rx={2}
        fill="#fafdf7"
        opacity="0.3"
      />

      {/* Hazards */}
      {hazards.filter(hasCarryPoint).map((h) => {
        const pos = { lat: h.carryPoint.y, lng: h.carryPoint.x };
        const hx = toSvgX(teePosition, greenCenter, pos);
        const hy = toSvgY(teePosition, greenCenter, pos);
        return (
          <ellipse
            key={`hazard-${h.type}-${h.carryPoint.x}-${h.carryPoint.y}`}
            cx={hx}
            cy={hy}
            rx={10}
            ry={6}
            fill={h.type === "bunker" ? "#d4b968" : "#4a9fd4"}
            opacity={0.6}
          />
        );
      })}

      {/* Player + dashed line to green */}
      {playerSvgX != null && playerSvgY != null && (
        <>
          <line
            x1={playerSvgX}
            y1={playerSvgY}
            x2={CENTER_X}
            y2={GREEN_Y}
            stroke="#fafdf7"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.4"
          />

          {/* Pulse ring */}
          <circle
            cx={playerSvgX}
            cy={playerSvgY}
            r={6}
            fill="#d4a843"
            opacity="0.25"
            className="animate-gps-pulse"
          />

          {/* Player dot */}
          <circle cx={playerSvgX} cy={playerSvgY} r={5} fill="#d4a843" />
          <circle cx={playerSvgX} cy={playerSvgY} r={2.5} fill="#fafdf7" />

          {/* Distance badge */}
          {distanceToCenter != null && (
            <foreignObject
              x={(playerSvgX + CENTER_X) / 2 - 22}
              y={(playerSvgY + GREEN_Y) / 2 - 10}
              width={44}
              height={20}
            >
              <div className="flex items-center justify-center rounded-md bg-pine/80 px-1.5 py-0.5">
                <span className="font-mono text-[10px] font-medium text-cream">
                  {distanceToCenter}m
                </span>
              </div>
            </foreignObject>
          )}
        </>
      )}
    </svg>
  );
}
