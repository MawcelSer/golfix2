import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
    },
  });

  // ── Security ───────────────────────────────────────────────────

  await app.register(helmet);

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? ["https://localhost:5173", "https://localhost:5174"],
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

    reply.status(statusCode).send({
      error: statusCode >= 500 ? "Internal Server Error" : error.message,
      statusCode,
    });
  });

  // ── Routes ─────────────────────────────────────────────────────

  await app.register(
    async (api) => {
      api.get("/health", async () => {
        return { status: "ok", timestamp: new Date().toISOString() };
      });

      const { authRoutes } = await import("./auth/auth-routes");
      await api.register(authRoutes, { prefix: "/auth" });
    },
    { prefix: "/api/v1" },
  );

  // ── Dev simulation ────────────────────────────────────────────

  if (process.env.DEV_SIMULATE === "true") {
    const { simulationPlugin } = await import("./simulation/simulation-plugin");
    await app.register(simulationPlugin);
  }

  return app;
}
