import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { startSessionSchema, finishSessionSchema, sessionIdParamSchema } from "./session-schemas";
import { startSession, finishSession, getSession, SessionError } from "./session-service";
import { verifyToken } from "../middleware/auth-middleware";

// ── Helpers ─────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

// ── Plugin ──────────────────────────────────────────────────────────

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // All session routes require authentication
  app.addHook("onRequest", verifyToken);

  // ── POST /start ───────────────────────────────────────────────────

  app.post("/start", {
    handler: async (request, reply) => {
      const parsed = startSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await startSession(request.userId!, parsed.data.courseId);
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof SessionError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });

  // ── PATCH /:id/finish ─────────────────────────────────────────────

  app.patch("/:id/finish", {
    handler: async (request, reply) => {
      const paramsParsed = sessionIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const parsed = finishSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await finishSession(paramsParsed.data.id, request.userId!, parsed.data.status);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof SessionError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });

  // ── GET /:id ──────────────────────────────────────────────────────

  app.get("/:id", {
    handler: async (request, reply) => {
      const paramsParsed = sessionIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      try {
        const result = await getSession(paramsParsed.data.id, request.userId!);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof SessionError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });
}
