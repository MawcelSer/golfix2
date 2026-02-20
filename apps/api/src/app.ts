import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { sql } from "drizzle-orm";
import { db } from "./db/connection";
import { captureError } from "./monitoring/sentry";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie"],
        censor: "[REDACTED]",
      },
    },
  });

  // ── Security ───────────────────────────────────────────────────

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "wss:", "https:"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for PWA service worker
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
      : ["https://localhost:5173", "https://localhost:5174"],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // ── Error handler ──────────────────────────────────────────────

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;

    app.log.error({
      err: error,
      statusCode,
    });

    if (statusCode >= 500) {
      captureError(error, { statusCode });
    }

    reply.status(statusCode).send({
      error: statusCode >= 500 ? "Internal Server Error" : error.message,
      statusCode,
    });
  });

  // ── Routes ─────────────────────────────────────────────────────

  await app.register(
    async (api) => {
      api.get("/health", async () => {
        let dbStatus = "connected";
        try {
          await db.execute(sql`SELECT 1`);
        } catch {
          dbStatus = "disconnected";
        }

        const isProd = process.env.NODE_ENV === "production";
        return {
          status: dbStatus === "connected" ? "ok" : "degraded",
          timestamp: new Date().toISOString(),
          db: dbStatus,
          ...(isProd
            ? {}
            : { uptime: process.uptime(), version: process.env.npm_package_version ?? "0.0.0" }),
        };
      });

      const { authRoutes } = await import("./auth/auth-routes");
      await api.register(authRoutes, { prefix: "/auth" });

      const { courseRoutes } = await import("./courses/course-routes");
      await api.register(courseRoutes, { prefix: "/courses" });

      const { sessionRoutes } = await import("./sessions/session-routes");
      await api.register(sessionRoutes, { prefix: "/sessions" });

      const { positionRoutes } = await import("./positions/position-routes");
      await api.register(positionRoutes, { prefix: "/positions" });

      const { scoringRoutes } = await import("./scoring/scoring-routes");
      await api.register(scoringRoutes);

      const { userRoutes } = await import("./users/user-routes");
      // No prefix: routes declare their own full paths (/users/me/...)
      await api.register(userRoutes);

      const { teeTimeRoutes } = await import("./tee-times/tee-time-routes");
      await api.register(teeTimeRoutes, { prefix: "/courses/:courseId/tee-times" });

      const { courseSettingsRoutes } = await import("./courses/course-settings-routes");
      await api.register(courseSettingsRoutes, { prefix: "/courses/:courseId" });

      const { reminderRoutes } = await import("./pace/reminder-routes");
      await api.register(reminderRoutes, { prefix: "/courses/:courseId/reminders" });

      const { reportRoutes } = await import("./reports/report-routes");
      await api.register(reportRoutes, { prefix: "/courses/:courseId/reports" });
    },
    { prefix: "/api/v1" },
  );

  // ── Dev simulation ────────────────────────────────────────────

  if (process.env.DEV_SIMULATE === "true") {
    const { simulationPlugin } = await import("./simulation/simulation-plugin");
    await app.register(simulationPlugin);
  }

  // ── WebSocket (Socket.io) ───────────────────────────────────

  const { setupSocketServer } = await import("./ws/socket-server");
  const io = setupSocketServer(app);

  // Decorate app with io for use by pace engine plugin
  app.decorate("io", io);

  // ── Pace engine (real-time dashboard aggregation) ──────────

  const { paceEnginePlugin } = await import("./pace/pace-engine-plugin");
  await app.register(paceEnginePlugin);

  return app;
}
