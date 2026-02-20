import type { FastifyInstance } from "fastify";
import {
  createTeeTimeSchema,
  updateTeeTimeSchema,
  listTeeTimesSchema,
  courseIdParamSchema,
  teeTimeIdParamSchema,
} from "./tee-time-schemas";
import {
  createTeeTime,
  listTeeTimes,
  getTeeTime,
  updateTeeTime,
  deleteTeeTime,
  TeeTimeError,
} from "./tee-time-service";
import { verifyToken, requireRole } from "../middleware/auth-middleware";
import { formatZodError } from "../lib/format-zod-error";

// ── Plugin ──────────────────────────────────────────────────────────

export async function teeTimeRoutes(app: FastifyInstance): Promise<void> {
  // All tee time routes require authentication + course admin role
  app.addHook("onRequest", verifyToken);
  app.addHook("onRequest", requireRole("owner", "admin", "marshal"));

  // ── GET / ──────────────────────────────────────────────────────────

  app.get<{ Querystring: { date?: string } }>("/", {
    handler: async (request, reply) => {
      const paramsParsed = courseIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const date = request.query.date ?? new Date().toISOString().split("T")[0]!;
      const parsed = listTeeTimesSchema.safeParse({ date });
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await listTeeTimes(paramsParsed.data.courseId, parsed.data.date);
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

  app.post("/", {
    handler: async (request, reply) => {
      const paramsParsed = courseIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const parsed = createTeeTimeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await createTeeTime(paramsParsed.data.courseId, parsed.data);
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

  app.get("/:teeTimeId", {
    handler: async (request, reply) => {
      const paramsParsed = teeTimeIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      try {
        const result = await getTeeTime(paramsParsed.data.teeTimeId, paramsParsed.data.courseId);
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

  app.put("/:teeTimeId", {
    handler: async (request, reply) => {
      const paramsParsed = teeTimeIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const parsed = updateTeeTimeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await updateTeeTime(
          paramsParsed.data.teeTimeId,
          paramsParsed.data.courseId,
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

  app.delete("/:teeTimeId", {
    handler: async (request, reply) => {
      const paramsParsed = teeTimeIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      try {
        await deleteTeeTime(paramsParsed.data.teeTimeId, paramsParsed.data.courseId);
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
