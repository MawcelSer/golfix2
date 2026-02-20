import { z } from "zod";

// ── Request schemas ─────────────────────────────────────────────────

export const createTeeTimeSchema = z.object({
  scheduledAt: z.string().datetime({ message: "Must be ISO 8601 datetime" }),
  playersCount: z.number().int().min(1).max(4).default(4),
  notes: z.string().max(500).optional(),
});

export const updateTeeTimeSchema = z.object({
  scheduledAt: z.string().datetime({ message: "Must be ISO 8601 datetime" }).optional(),
  playersCount: z.number().int().min(1).max(4).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const listTeeTimesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
});

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid(),
});

export const teeTimeIdParamSchema = z.object({
  courseId: z.string().uuid(),
  teeTimeId: z.string().uuid(),
});

// ── Inferred types ──────────────────────────────────────────────────

export type CreateTeeTimeInput = z.infer<typeof createTeeTimeSchema>;
export type UpdateTeeTimeInput = z.infer<typeof updateTeeTimeSchema>;

// ── Response types ──────────────────────────────────────────────────

export interface TeeTimeResponse {
  id: string;
  courseId: string;
  scheduledAt: string;
  playersCount: number;
  notes: string | null;
  createdAt: string;
}
