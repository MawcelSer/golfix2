import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { updatePrefsSchema } from "./user-schemas";
import { getUserPreferences, updateUserPreferences, UserNotFoundError } from "./user-service";
import { exportUserData } from "./gdpr-service";
import { verifyToken } from "../middleware/auth-middleware";

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifyToken);

  // ── GDPR export ──────────────────────────────────────────────────

  app.get("/users/me/export", {
    handler: async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Authentication required", statusCode: 401 });
      }

      try {
        const data = await exportUserData(request.userId);
        return reply
          .header("Content-Disposition", 'attachment; filename="golfix-data-export.json"')
          .header("Content-Type", "application/json")
          .status(200)
          .send(data);
      } catch (err) {
        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({ error: err.message, statusCode: 404 });
        }
        throw err;
      }
    },
  });

  // ── Preferences ──────────────────────────────────────────────────

  app.get("/users/me/preferences", {
    handler: async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Authentication required", statusCode: 401 });
      }

      try {
        const result = await getUserPreferences(request.userId);
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({ error: err.message, statusCode: 404 });
        }
        app.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error", statusCode: 500 });
      }
    },
  });

  app.patch("/users/me/preferences", {
    handler: async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Authentication required", statusCode: 401 });
      }

      const parsed = updatePrefsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await updateUserPreferences(request.userId, parsed.data);
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({ error: err.message, statusCode: 404 });
        }
        app.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error", statusCode: 500 });
      }
    },
  });
}
