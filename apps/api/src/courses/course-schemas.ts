import { z } from "zod";

// ── Request schemas ─────────────────────────────────────────────────

export const locateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const courseSlugParamSchema = z.object({
  slug: z.string().min(1).max(100),
});

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid(),
});

// ── Inferred types ──────────────────────────────────────────────────

export type LocateInput = z.infer<typeof locateSchema>;
