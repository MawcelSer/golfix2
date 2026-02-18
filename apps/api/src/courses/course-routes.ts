import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { locateSchema } from "./course-schemas";
import { locateCourse, getCourseData } from "./course-service";

// ── Helpers ─────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

// ── Plugin ──────────────────────────────────────────────────────────

export async function courseRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /locate ──────────────────────────────────────────────────

  app.post("/locate", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const parsed = locateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      const result = await locateCourse(parsed.data.lat, parsed.data.lng);
      if (!result) {
        return reply
          .status(404)
          .send({ error: "No course found at this location", statusCode: 404 });
      }

      return reply.status(200).send(result);
    },
  });

  // ── GET /:slug/data ───────────────────────────────────────────────

  app.get("/:slug/data", {
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };

      const data = await getCourseData(slug);
      if (!data) {
        return reply.status(404).send({ error: "Course not found", statusCode: 404 });
      }

      return reply.status(200).send(data);
    },
  });
}
