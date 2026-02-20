import type { FastifyInstance } from "fastify";
import { updatePrefsSchema, deleteAccountSchema } from "./user-schemas";
import { getUserPreferences, updateUserPreferences, UserNotFoundError } from "./user-service";
import {
  exportUserData,
  deleteUserAccount,
  PasswordRequiredError,
  InvalidPasswordError,
} from "./gdpr-service";
import { verifyToken } from "../middleware/auth-middleware";
import { formatZodError } from "../lib/format-zod-error";

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

  // ── GDPR deletion ───────────────────────────────────────────────

  app.delete("/users/me", {
    handler: async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: "Authentication required", statusCode: 401 });
      }

      const parsed = deleteAccountSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        await deleteUserAccount(request.userId, parsed.data.password);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof PasswordRequiredError) {
          return reply.status(400).send({ error: err.message, statusCode: 400 });
        }
        if (err instanceof InvalidPasswordError) {
          return reply.status(403).send({ error: err.message, statusCode: 403 });
        }
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
