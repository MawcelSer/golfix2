import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { createTeeTimeSchema, updateTeeTimeSchema, listTeeTimesSchema } from "./tee-time-schemas";
import {
  createTeeTime,
  listTeeTimes,
  getTeeTime,
  updateTeeTime,
  deleteTeeTime,
  TeeTimeError,
} from "./tee-time-service";
import { verifyToken, requireRole } from "../middleware/auth-middleware";

// ── Helpers ─────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

// ── Plugin ──────────────────────────────────────────────────────────

export async function teeTimeRoutes(app: FastifyInstance): Promise<void> {
  // All tee time routes require authentication + course admin role
  app.addHook("onRequest", verifyToken);
  app.addHook("onRequest", requireRole("owner", "admin", "marshal"));

  // ── GET / ──────────────────────────────────────────────────────────

  app.get<{ Params: { courseId: string }; Querystring: { date?: string } }>("/", {
    handler: async (request, reply) => {
      const date = request.query.date ?? new Date().toISOString().split("T")[0]!;
      const parsed = listTeeTimesSchema.safeParse({ date });
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await listTeeTimes(request.params.courseId, parsed.data.date);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof TeeTimeError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });

  // ── POST / ─────────────────────────────────────────────────────────

  app.post<{ Params: { courseId: string } }>("/", {
    handler: async (request, reply) => {
      const parsed = createTeeTimeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await createTeeTime(request.params.courseId, parsed.data);
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof TeeTimeError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });

  // ── GET /:teeTimeId ───────────────────────────────────────────────

  app.get<{ Params: { courseId: string; teeTimeId: string } }>("/:teeTimeId", {
    handler: async (request, reply) => {
      try {
        const result = await getTeeTime(request.params.teeTimeId, request.params.courseId);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof TeeTimeError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });

  // ── PUT /:teeTimeId ──────────────────────────────────────────────

  app.put<{ Params: { courseId: string; teeTimeId: string } }>("/:teeTimeId", {
    handler: async (request, reply) => {
      const parsed = updateTeeTimeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await updateTeeTime(
          request.params.teeTimeId,
          request.params.courseId,
          parsed.data,
        );
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof TeeTimeError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });

  // ── DELETE /:teeTimeId ────────────────────────────────────────────

  app.delete<{ Params: { courseId: string; teeTimeId: string } }>("/:teeTimeId", {
    handler: async (request, reply) => {
      try {
        await deleteTeeTime(request.params.teeTimeId, request.params.courseId);
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof TeeTimeError) {
          return reply
            .status(error.statusCode)
            .send({ error: error.message, statusCode: error.statusCode });
        }
        throw error;
      }
    },
  });
}
