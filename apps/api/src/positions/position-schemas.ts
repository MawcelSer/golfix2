import { z } from "zod";

// ── Request schemas ─────────────────────────────────────────────────

export const positionBatchSchema = z.object({
  sessionId: z.string().uuid(),
  positions: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy: z.number().positive(),
        recordedAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(2000),
});

// ── Inferred types ──────────────────────────────────────────────────

export type PositionBatchInput = z.infer<typeof positionBatchSchema>;

// ── Response types ──────────────────────────────────────────────────

export interface PositionBatchResponse {
  inserted: number;
}
