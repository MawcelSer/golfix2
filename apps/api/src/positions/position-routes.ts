import type { FastifyInstance } from "fastify";
import { positionBatchSchema } from "./position-schemas";
import { batchInsertPositions, PositionError } from "./position-service";
import { verifyToken } from "../middleware/auth-middleware";
import { formatZodError } from "../lib/format-zod-error";

// ── Plugin ──────────────────────────────────────────────────────────

export async function positionRoutes(app: FastifyInstance): Promise<void> {
  // All position routes require authentication
  app.addHook("onRequest", verifyToken);

  // ── POST /batch ───────────────────────────────────────────────────

  app.post("/batch", {
    handler: async (request, reply) => {
      const parsed = positionBatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const inserted = await batchInsertPositions(
          parsed.data.sessionId,
          request.userId!,
          parsed.data.positions,
        );
        return reply.status(201).send({ inserted });
      } catch (error) {
        if (error instanceof PositionError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });
}
