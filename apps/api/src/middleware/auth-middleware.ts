import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../auth/auth-service";
import { db } from "../db/connection";
import { courseRoles } from "../db/schema/index";
import { eq, and } from "drizzle-orm";

// ── Augment FastifyRequest ──────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

// ── verifyToken ─────────────────────────────────────────────────────

export async function verifyToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply
      .status(401)
      .send({ error: "Missing or invalid authorization header", statusCode: 401 });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    request.userId = payload.sub;
  } catch {
    reply.status(401).send({ error: "Invalid or expired token", statusCode: 401 });
  }
}

// ── requireRole ─────────────────────────────────────────────────────

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.userId) {
      reply.status(401).send({ error: "Authentication required", statusCode: 401 });
      return;
    }

    // Extract courseId from route params (supports both :courseId and :id)
    const params = request.params as Record<string, string>;
    const courseId = params.courseId ?? params.id;

    if (!courseId) {
      reply.status(400).send({ error: "Course ID required", statusCode: 400 });
      return;
    }

    const rows = await db
      .select({ role: courseRoles.role })
      .from(courseRoles)
      .where(and(eq(courseRoles.userId, request.userId), eq(courseRoles.courseId, courseId)))
      .limit(1);

    const userRole = rows[0]?.role;

    if (!userRole || !roles.includes(userRole)) {
      reply.status(403).send({ error: "Insufficient permissions", statusCode: 403 });
    }
  };
}
