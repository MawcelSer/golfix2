import type { FastifyInstance } from "fastify";
import { reminderParamsSchema, reminderBodySchema } from "./reminder-schemas";
import { sendReminder, GroupNotFoundError } from "./reminder-service";
import { verifyToken, requireRole } from "../middleware/auth-middleware";
import { formatZodError } from "../lib/format-zod-error";

export async function reminderRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifyToken);

  // POST /courses/:courseId/reminders/:groupId — owner/admin/marshal
  app.post("/:groupId", {
    preHandler: requireRole("owner", "admin", "marshal"),
    handler: async (request, reply) => {
      const paramsParsed = reminderParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const bodyParsed = reminderBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: formatZodError(bodyParsed.error), statusCode: 400 });
      }

      try {
        const result = await sendReminder({
          courseId: paramsParsed.data.courseId,
          groupId: paramsParsed.data.groupId,
          sentByUserId: request.userId!,
          message: bodyParsed.data.message,
        });

        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof GroupNotFoundError) {
          return reply.status(404).send({ error: err.message, statusCode: 404 });
        }
        throw err;
      }
    },
  });
}
