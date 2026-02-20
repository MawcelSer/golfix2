import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { createRoundSchema, upsertScoreSchema, roundIdParamSchema } from "./scoring-schemas";
import {
  createRound,
  upsertScore,
  getUserRounds,
  getRoundDetail,
  ScoringError,
} from "./scoring-service";
import { verifyToken } from "../middleware/auth-middleware";

// ── Helpers ─────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

// ── Plugin ──────────────────────────────────────────────────────────

export async function scoringRoutes(app: FastifyInstance): Promise<void> {
  // All scoring routes require authentication
  app.addHook("onRequest", verifyToken);

  // ── POST /rounds ──────────────────────────────────────────────────

  app.post("/rounds", {
    handler: async (request, reply) => {
      const parsed = createRoundSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await createRound(
          request.userId!,
          parsed.data.courseId,
          parsed.data.sessionId,
        );
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof ScoringError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });

  // ── PUT /rounds/:id/scores ────────────────────────────────────────

  app.put("/rounds/:id/scores", {
    handler: async (request, reply) => {
      const paramsParsed = roundIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const parsed = upsertScoreSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await upsertScore(paramsParsed.data.id, request.userId!, parsed.data);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof ScoringError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });

  // ── GET /users/me/rounds ──────────────────────────────────────────

  app.get("/users/me/rounds", {
    handler: async (request, reply) => {
      const result = await getUserRounds(request.userId!);
      return reply.status(200).send(result);
    },
  });

  // ── GET /rounds/:id ───────────────────────────────────────────────

  app.get("/rounds/:id", {
    handler: async (request, reply) => {
      const paramsParsed = roundIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      try {
        const result = await getRoundDetail(paramsParsed.data.id, request.userId!);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof ScoringError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });
}
