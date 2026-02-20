import type { FastifyInstance } from "fastify";
import { dailyReportParamsSchema } from "./report-schemas";
import { getDailyReport } from "./report-service";
import { verifyToken, requireRole } from "../middleware/auth-middleware";
import { formatZodError } from "../lib/format-zod-error";

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifyToken);

  // GET /courses/:courseId/reports/daily/:date — all manager roles + viewer
  app.get("/daily/:date", {
    preHandler: requireRole("owner", "admin", "marshal", "viewer"),
    handler: async (request, reply) => {
      const parsed = dailyReportParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      const report = await getDailyReport(parsed.data.courseId, parsed.data.date);
      return reply.status(200).send(report);
    },
  });
}
