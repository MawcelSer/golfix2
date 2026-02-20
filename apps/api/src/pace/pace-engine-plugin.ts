import type { FastifyInstance } from "fastify";
import type { Server } from "socket.io";
import { PaceEngineManager } from "./pace-engine-manager";
import type { GroupState, PaceAlert } from "./pace-types";
import type { BottleneckState } from "./bottleneck-detector";
import type {
  DashboardGroupUpdate,
  DashboardAlertEvent,
  DashboardBottleneckEvent,
} from "@golfix/shared";

const TICK_INTERVAL_MS = 5000;

// ── Serializers ─────────────────────────────────────────────────────

function serializeGroup(
  group: GroupState,
  projectedFinish: Date | null,
  positions: Map<string, { lat: number; lng: number }>,
): DashboardGroupUpdate {
  let centroid: { lat: number; lng: number } | null = null;
  const coords: { lat: number; lng: number }[] = [];

  for (const sessionId of group.sessions) {
    const pos = positions.get(sessionId);
    if (pos) coords.push(pos);
  }

  if (coords.length > 0) {
    const sumLat = coords.reduce((sum, c) => sum + c.lat, 0);
    const sumLng = coords.reduce((sum, c) => sum + c.lng, 0);
    centroid = { lat: sumLat / coords.length, lng: sumLng / coords.length };
  }

  return {
    groupId: group.id,
    groupNumber: group.groupNumber,
    currentHole: group.currentHole,
    paceStatus: group.paceStatus,
    paceFactor: group.paceFactor,
    sessions: group.sessions,
    projectedFinish: projectedFinish?.toISOString() ?? null,
    centroid,
  };
}

function serializeAlert(alert: PaceAlert): DashboardAlertEvent {
  return {
    type: alert.type,
    severity: alert.severity,
    groupId: alert.groupId,
    groupNumber: alert.groupNumber,
    currentHole: alert.currentHole,
    details: alert.details,
    timestamp: alert.timestamp.toISOString(),
  };
}

function serializeBottleneck(bn: BottleneckState, groups: GroupState[]): DashboardBottleneckEvent {
  const affected = groups
    .filter((g) => g.currentHole === bn.hole && g.id !== bn.blockerGroupId)
    .map((g) => g.id);

  return {
    hole: bn.hole,
    blockerGroupId: bn.blockerGroupId,
    affectedGroupIds: affected,
    rootHole: bn.rootHole,
    isCascade: bn.isCascade,
    timestamp: new Date().toISOString(),
  };
}

// ── Plugin ──────────────────────────────────────────────────────────

export async function paceEnginePlugin(app: FastifyInstance): Promise<void> {
  const io = (app as unknown as { io?: Server }).io;
  if (!io) {
    app.log.warn("Socket.io not available — pace engine plugin disabled");
    return;
  }

  const manager = new PaceEngineManager();
  app.decorate("paceEngineManager", manager);

  const interval = setInterval(() => {
    const now = new Date();

    for (const [courseId, entry] of manager.getActiveEngines()) {
      try {
        entry.engine.updatePositions(
          new Map(
            [...entry.positions.entries()].map(([sid, p]) => [
              sid,
              { sessionId: sid, lat: p.lat, lng: p.lng, recordedAt: p.recordedAt },
            ]),
          ),
          entry.holeDetections,
          now,
        );

        const result = entry.engine.tick(now);
        const room = `course:${courseId}:dashboard`;

        const groupUpdates = result.groups.map((g) =>
          serializeGroup(g, result.projectedFinishes.get(g.id) ?? null, entry.positions),
        );

        if (groupUpdates.length > 0) {
          io.to(room).emit("groups:update", groupUpdates);
        }

        for (const alert of result.alerts) {
          io.to(room).emit("alert:new", serializeAlert(alert));
        }

        if (result.bottlenecks.length > 0) {
          const bnEvents = result.bottlenecks.map((bn) => serializeBottleneck(bn, result.groups));
          io.to(room).emit("bottleneck:update", bnEvents);
        }

        entry.positions.clear();
        entry.holeDetections.clear();
      } catch (err) {
        app.log.error({ err, courseId }, "Pace engine tick failed");
      }
    }
  }, TICK_INTERVAL_MS);

  app.addHook("onClose", () => {
    clearInterval(interval);
    manager.clear();
  });
}

// ── Fastify augmentation ────────────────────────────────────────────

declare module "fastify" {
  interface FastifyInstance {
    paceEngineManager: PaceEngineManager;
  }
}
