import type { FastifyInstance } from "fastify";

import { runInternalSimulation } from "./internal-engine";
import { COURSE_NAME, HOLES_DATA } from "./seed-coords";
import { positionBuffer } from "../positions/position-buffer";
import type { PositionEvent } from "./types";

/**
 * Fastify plugin that runs a golf simulation when DEV_SIMULATE=true.
 *
 * Feeds positions directly to the internal pipeline (bypasses Socket.io + auth).
 * Start with: DEV_SIMULATE=true DEV_SIM_SPEED=30 pnpm dev:api
 */
export async function simulationPlugin(app: FastifyInstance): Promise<void> {
  const speed = parseInt(process.env.DEV_SIM_SPEED ?? "30", 10);
  const groupCount = parseInt(process.env.DEV_SIM_GROUPS ?? "4", 10);
  const seed = process.env.DEV_SIM_SEED ? parseInt(process.env.DEV_SIM_SEED, 10) : undefined;

  const abortController = new AbortController();

  app.log.info(`Simulation activée — ${COURSE_NAME}, ${groupCount} groupes, ${speed}x`);

  // Expose simulation status via REST
  app.get("/api/v1/simulation/status", async () => {
    return {
      active: !abortController.signal.aborted,
      speed,
      groupCount,
      course: COURSE_NAME,
    };
  });

  // Stop simulation via REST
  app.post("/api/v1/simulation/stop", async () => {
    abortController.abort();
    return { stopped: true };
  });

  // Position handler — feeds into the position pipeline
  const handlePosition = (event: PositionEvent): void => {
    app.log.debug(
      { group: event.groupIndex, hole: event.hole, lat: event.lat, lng: event.lng },
      "Sim position",
    );

    positionBuffer.add({
      sessionId: event.sessionId,
      lat: event.lat,
      lng: event.lng,
      accuracy: event.accuracy,
      recordedAt: event.recordedAt,
    });
  };

  // Start simulation after server is ready
  app.addHook("onReady", async () => {
    app.log.info("Démarrage simulation en arrière-plan...");

    // Run in background — don't block server startup
    runInternalSimulation(
      {
        speed,
        groupCount,
        seed,
        holesData: [...HOLES_DATA],
      },
      handlePosition,
      abortController.signal,
    )
      .then(() => {
        app.log.info("Simulation terminée");
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          app.log.error(err, "Erreur simulation");
        }
      });
  });

  // Clean shutdown
  app.addHook("onClose", async () => {
    abortController.abort();
  });
}
