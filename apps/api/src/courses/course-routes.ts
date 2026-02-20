import type { FastifyInstance } from "fastify";
import { locateSchema, courseSlugParamSchema } from "./course-schemas";
import { locateCourse, getCourseData, getManagedCourses } from "./course-service";
import { verifyToken } from "../middleware/auth-middleware";
import { formatZodError } from "../lib/format-zod-error";

// ── Plugin ──────────────────────────────────────────────────────────

export async function courseRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /managed ────────────────────────────────────────────────────

  app.get("/managed", {
    onRequest: [verifyToken],
    handler: async (request, reply) => {
      const courses = await getManagedCourses(request.userId!);
      return reply.status(200).send(courses);
    },
  });

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
      const parsed = courseSlugParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }
      const { slug } = parsed.data;

      const data = await getCourseData(slug);
      if (!data) {
        return reply.status(404).send({ error: "Course not found", statusCode: 404 });
      }

      return reply.status(200).send(data);
    },
  });
}
