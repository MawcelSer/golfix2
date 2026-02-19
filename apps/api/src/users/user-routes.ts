import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { updatePrefsSchema } from "./user-schemas";
import { getUserPreferences, updateUserPreferences } from "./user-service";
import { verifyToken } from "../middleware/auth-middleware";

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifyToken);

  app.get("/users/me/preferences", {
    handler: async (request, reply) => {
      const result = await getUserPreferences(request.userId!);
      return reply.status(200).send(result);
    },
  });

  app.patch("/users/me/preferences", {
    handler: async (request, reply) => {
      const parsed = updatePrefsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      const result = await updateUserPreferences(request.userId!, parsed.data);
      return reply.status(200).send(result);
    },
  });
}
