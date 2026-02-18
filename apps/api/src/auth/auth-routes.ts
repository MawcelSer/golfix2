import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { registerSchema, loginSchema, anonymousSchema, refreshSchema } from "./auth-schemas";
import {
  registerUser,
  loginUser,
  registerAnonymous,
  rotateRefreshToken,
  revokeRefreshToken,
  AuthError,
} from "./auth-service";

// ── Helpers ─────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}

function isDuplicateEmail(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("unique") && error.message.includes("email")
  );
}

// ── Plugin ──────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /register ──────────────────────────────────────────────

  app.post("/register", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await registerUser(parsed.data);
        return reply.status(201).send(result);
      } catch (error) {
        if (isDuplicateEmail(error)) {
          return reply.status(409).send({ error: "Email already registered", statusCode: 409 });
        }
        throw error;
      }
    },
  });

  // ── POST /login ─────────────────────────────────────────────────

  app.post("/login", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const result = await loginUser(parsed.data);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error && error.message === "Invalid credentials") {
          return reply.status(401).send({ error: "Invalid credentials", statusCode: 401 });
        }
        throw error;
      }
    },
  });

  // ── POST /anonymous ─────────────────────────────────────────────

  app.post("/anonymous", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    handler: async (request, reply) => {
      const parsed = anonymousSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      const result = await registerAnonymous(parsed.data);
      return reply.status(201).send(result);
    },
  });

  // ── POST /refresh ───────────────────────────────────────────────

  app.post("/refresh", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      try {
        const tokens = await rotateRefreshToken(parsed.data.refreshToken);
        return reply.status(200).send(tokens);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.status(401).send({ error: error.message, statusCode: 401 });
        }
        throw error;
      }
    },
  });

  // ── POST /logout ────────────────────────────────────────────────

  app.post("/logout", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: formatZodError(parsed.error), statusCode: 400 });
      }

      await revokeRefreshToken(parsed.data.refreshToken);
      return reply.status(200).send({ message: "Logged out" });
    },
  });
}
