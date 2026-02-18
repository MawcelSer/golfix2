import { AuthClient } from "./auth-client";
import { SimLogger } from "./logger";
import {
  computeHole,
  createRng,
  gaussianNoise,
  generateHoleWaypoints,
} from "./path-generator";
import { SessionManager } from "./session-manager";
import { SimClock } from "./sim-clock";
import { SocketClient } from "./socket-client";
import type {
  ComputedHole,
  GroupScenario,
  GroupState,
  PositionEvent,
  ScenarioDefinition,
  SimulatorOptions,
  Waypoint,
} from "./types";

// ── Hole data (mirrors seed.ts) ─────────────────────────────────────

const HOLES_DATA = [
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

const COMPUTED_HOLES: ComputedHole[] = HOLES_DATA.map(computeHole);
const TEE_INTERVAL_MS = 8 * 60 * 1000; // 8 minutes between groups
const POSITION_INTERVAL_MS = 5000; // 5 seconds between GPS readings

/**
 * Calculate the play time for a group on a specific hole.
 * Applies pace factor, noise, and stuck time.
 */
function calculateHolePlayTimeMs(
  hole: ComputedHole,
  scenario: GroupScenario,
  rng: () => number,
): number {
  const baseMs = hole.targetMinutes * 60_000;
  const pacedMs = baseMs * scenario.paceFactor;
  const noise = gaussianNoise(rng, scenario.holeNoise * 1000);
  const stuckEntry = scenario.stuckHoles.find((s) => s.hole === hole.num);
  const stuckMs = stuckEntry ? stuckEntry.extraMinutes * 60_000 : 0;
  return Math.max(30_000, pacedMs + noise + stuckMs); // minimum 30s per hole
}

/**
 * Pre-generate all waypoints for a group's entire round.
 * Returns a flat array of PositionEvents sorted by recordedAt.
 */
function generateGroupWaypoints(
  scenario: GroupScenario,
  startTime: Date,
  seed: number,
): Waypoint[][] {
  const rng = createRng(seed + scenario.groupIndex * 1000);
  const holeWaypoints: Waypoint[][] = [];
  let currentTime = startTime.getTime();

  const maxHole = scenario.dropOutAtHole ?? 18;

  for (let i = 0; i < maxHole; i++) {
    const hole = COMPUTED_HOLES[i]!;
    const playTimeMs = calculateHolePlayTimeMs(hole, scenario, rng);

    const waypoints = generateHoleWaypoints(
      hole,
      playTimeMs,
      new Date(currentTime),
      POSITION_INTERVAL_MS,
      rng,
    );

    holeWaypoints.push(waypoints);
    currentTime += playTimeMs + hole.transition * 60_000;
  }

  return holeWaypoints;
}

// ── Dry run mode ────────────────────────────────────────────────────

/** Run simulation without network — just generate and log waypoints */
export function runDryMode(
  scenario: ScenarioDefinition,
  options: SimulatorOptions,
): void {
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0);

  const clock = new SimClock(startTime, options.speed);
  const logger = new SimLogger(clock, options.verbose);

  logger.header("Golf de Bordeaux-Lac (Test)", scenario.groups.length, options.speed);

  let totalWaypoints = 0;

  for (const group of scenario.groups) {
    const holeWaypoints = generateGroupWaypoints(group, startTime, options.seed ?? Date.now());
    const groupStart = new Date(
      startTime.getTime() + group.groupIndex * TEE_INTERVAL_MS,
    );

    logger.info(
      `Groupe ${group.groupIndex + 1}: départ ${groupStart.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}, pace ${group.paceFactor}x`,
    );

    for (let i = 0; i < holeWaypoints.length; i++) {
      const waypoints = holeWaypoints[i]!;
      const hole = COMPUTED_HOLES[i]!;
      totalWaypoints += waypoints.length;

      logger.debug(
        `  Trou ${hole.num} (par ${hole.par}): ${waypoints.length} points, ${Math.round((waypoints[waypoints.length - 1]!.recordedAt.getTime() - waypoints[0]!.recordedAt.getTime()) / 60_000)}min`,
      );
    }

    if (group.dropOutAtHole) {
      logger.groupDroppedOut(group.groupIndex, group.dropOutAtHole);
    }
  }

  logger.info(`Total: ${totalWaypoints} positions GPS générées`);
  logger.success("Dry run terminé (aucune connexion réseau)");
}

// ── Live simulation engine ──────────────────────────────────────────

/**
 * Main simulation engine that connects to the API and streams
 * GPS positions in real-time (accelerated by speed factor).
 */
export async function runLiveSimulation(
  scenario: ScenarioDefinition,
  options: SimulatorOptions,
): Promise<void> {
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0);

  const clock = new SimClock(startTime, options.speed);
  const logger = new SimLogger(clock, options.verbose);
  const authClient = new AuthClient(options.apiUrl);
  const sessionManager = new SessionManager(options.apiUrl);

  logger.header("Golf de Bordeaux-Lac (Test)", scenario.groups.length, options.speed);

  // Authenticate and create sessions for each group
  const groupStates: GroupState[] = [];
  const sockets: SocketClient[] = [];

  for (const group of scenario.groups) {
    const displayName = `Sim-Joueur-${group.groupIndex + 1}`;
    const deviceId = `sim-device-${group.groupIndex + 1}-${Date.now()}`;

    try {
      logger.debug(`Authentification ${displayName}...`);
      const auth = await authClient.registerAnonymous(displayName, deviceId);

      logger.debug(`Création session pour ${displayName}...`);
      // Using seed course — first course in DB
      const session = await sessionManager.createSession(
        "00000000-0000-0000-0000-000000000001", // placeholder — real courseId from seed
        auth.accessToken,
      );

      const socket = new SocketClient(options.apiUrl, auth.accessToken, logger);
      await socket.connect();
      sockets.push(socket);

      groupStates.push({
        groupIndex: group.groupIndex,
        scenario: group,
        currentHole: 1,
        holeStartTime: new Date(startTime.getTime() + group.groupIndex * TEE_INTERVAL_MS),
        finished: false,
        droppedOut: false,
        sessionId: session.sessionId,
        userId: auth.userId,
        token: auth.accessToken,
      });

      logger.info(`Groupe ${group.groupIndex + 1} connecté (session ${session.sessionId.slice(0, 8)}...)`);
    } catch (err) {
      logger.error(
        `Groupe ${group.groupIndex + 1} — échec connexion: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (groupStates.length === 0) {
    logger.error("Aucun groupe connecté — arrêt simulation");
    return;
  }

  // Pre-generate all waypoints
  const allWaypoints = new Map<number, Waypoint[][]>();
  for (const state of groupStates) {
    const waypoints = generateGroupWaypoints(
      state.scenario,
      state.holeStartTime,
      options.seed ?? Date.now(),
    );
    allWaypoints.set(state.groupIndex, waypoints);
  }

  // Emit waypoints in real-time
  const emissionPromises: Promise<void>[] = [];

  for (const state of groupStates) {
    const holeWaypoints = allWaypoints.get(state.groupIndex)!;
    const socket = sockets[groupStates.indexOf(state)]!;

    const promise = emitGroupPositions(
      state,
      holeWaypoints,
      socket,
      clock,
      logger,
    );
    emissionPromises.push(promise);
  }

  await Promise.all(emissionPromises);

  // Finish sessions
  for (const state of groupStates) {
    if (state.sessionId && state.token) {
      try {
        await sessionManager.finishSession(state.sessionId, state.token);
      } catch {
        // Session finish is best-effort
      }
    }
  }

  // Disconnect sockets
  for (const socket of sockets) {
    socket.disconnect();
  }

  logger.summary(
    18,
    clock.formatSimElapsed(),
    clock.formatRealElapsed(),
  );
}

/** Emit positions for one group, respecting real-time pacing */
async function emitGroupPositions(
  state: GroupState,
  holeWaypoints: Waypoint[][],
  socket: SocketClient,
  clock: SimClock,
  logger: SimLogger,
): Promise<void> {
  for (let holeIdx = 0; holeIdx < holeWaypoints.length; holeIdx++) {
    const hole = COMPUTED_HOLES[holeIdx]!;
    const waypoints = holeWaypoints[holeIdx]!;

    logger.groupMove(state.groupIndex, hole.num, hole.par);

    for (const wp of waypoints) {
      // Wait until it's time to emit this waypoint
      const simNow = clock.now();
      const delaySimMs = wp.recordedAt.getTime() - simNow.getTime();
      if (delaySimMs > 0) {
        const realDelayMs = clock.realMsFor(delaySimMs);
        await sleep(realDelayMs);
      }

      if (state.sessionId) {
        socket.emitPosition({
          sessionId: state.sessionId,
          lat: wp.lat,
          lng: wp.lng,
          accuracy: wp.accuracy,
          recordedAt: wp.recordedAt.toISOString(),
        });

        logger.position(state.groupIndex, hole.num, wp.lat, wp.lng);
      }
    }
  }

  if (state.scenario.dropOutAtHole) {
    logger.groupDroppedOut(state.groupIndex, state.scenario.dropOutAtHole);
  } else {
    logger.groupFinished(state.groupIndex, clock.formatSimElapsed());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// ── Position callback for internal/dev mode ─────────────────────────

export type PositionCallback = (event: PositionEvent) => void;

/**
 * Run simulation in internal mode — feeds positions directly via callback.
 * Used by the API dev mode plugin (no Socket.io, no auth).
 */
export async function runInternalSimulation(
  scenario: ScenarioDefinition,
  speed: number,
  onPosition: PositionCallback,
  signal?: AbortSignal,
): Promise<void> {
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0);

  const clock = new SimClock(startTime, speed);
  const seed = Date.now();

  // Pre-generate all waypoints per group
  const groupData = scenario.groups.map((group) => {
    const groupStart = new Date(
      startTime.getTime() + group.groupIndex * TEE_INTERVAL_MS,
    );
    const holeWaypoints = generateGroupWaypoints(group, groupStart, seed);
    return { group, holeWaypoints };
  });

  // Flatten all waypoints with metadata and sort by recordedAt
  const allEvents: PositionEvent[] = [];

  for (const { group, holeWaypoints } of groupData) {
    for (let holeIdx = 0; holeIdx < holeWaypoints.length; holeIdx++) {
      const hole = COMPUTED_HOLES[holeIdx]!;
      for (const wp of holeWaypoints[holeIdx]!) {
        allEvents.push({
          sessionId: `sim-session-${group.groupIndex}`,
          lat: wp.lat,
          lng: wp.lng,
          accuracy: wp.accuracy,
          recordedAt: wp.recordedAt,
          hole: hole.num,
          groupIndex: group.groupIndex,
        });
      }
    }
  }

  allEvents.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  // Emit in real-time according to clock speed
  for (const event of allEvents) {
    if (signal?.aborted) break;

    const simNow = clock.now();
    const delaySimMs = event.recordedAt.getTime() - simNow.getTime();
    if (delaySimMs > 0) {
      const realDelayMs = clock.realMsFor(delaySimMs);
      await sleep(realDelayMs);
    }

    if (signal?.aborted) break;
    onPosition(event);
  }
}
