import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { z } from "zod";
import { updateCourseSettingsSchema, courseIdParamSchema } from "./course-settings-schemas";
import {
  updateCourseSettings,
  listCourseRoles,
  assignCourseRole,
  removeCourseRole,
  CourseNotFoundError,
  RoleConflictError,
  UserNotFoundByEmailError,
  LastOwnerError,
} from "./course-settings-service";
import { verifyToken, requireRole } from "../middleware/auth-middleware";

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

const assignRoleSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "marshal", "viewer"]),
});

const roleIdParamSchema = z.object({
  courseId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export async function courseSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifyToken);

  // ── PATCH /settings — owner/admin ─────────────────────────────────

  app.patch("/settings", {
    preHandler: requireRole("owner", "admin"),
    handler: async (request, reply) => {
      const paramsParsed = courseIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const parsed = updateCourseSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await updateCourseSettings(paramsParsed.data.courseId, parsed.data);
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof CourseNotFoundError) {
          return reply.status(404).send({ error: err.message, statusCode: 404 });
        }
        throw err;
      }
    },
  });

  // ── GET /roles — owner/admin ──────────────────────────────────────

  app.get("/roles", {
    preHandler: requireRole("owner", "admin"),
    handler: async (request, reply) => {
      const paramsParsed = courseIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const roles = await listCourseRoles(paramsParsed.data.courseId);
      return reply.status(200).send(roles);
    },
  });

  // ── POST /roles — owner only ──────────────────────────────────────

  app.post("/roles", {
    preHandler: requireRole("owner"),
    handler: async (request, reply) => {
      const paramsParsed = courseIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      const parsed = assignRoleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await assignCourseRole(
          paramsParsed.data.courseId,
          parsed.data.email,
          parsed.data.role,
        );
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof UserNotFoundByEmailError) {
          return reply.status(404).send({ error: err.message, statusCode: 404 });
        }
        if (err instanceof RoleConflictError) {
          return reply.status(409).send({ error: err.message, statusCode: 409 });
        }
        throw err;
      }
    },
  });

  // ── DELETE /roles/:roleId — owner only ────────────────────────────

  app.delete("/roles/:roleId", {
    preHandler: requireRole("owner"),
    handler: async (request, reply) => {
      const paramsParsed = roleIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: formatZodError(paramsParsed.error), statusCode: 400 });
      }

      try {
        await removeCourseRole(paramsParsed.data.roleId, paramsParsed.data.courseId);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof LastOwnerError) {
          return reply.status(400).send({ error: err.message, statusCode: 400 });
        }
        throw err;
      }
    },
  });
}
