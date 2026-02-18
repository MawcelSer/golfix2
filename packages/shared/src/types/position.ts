// ── Single position ────────────────────────────────────────────────

export interface PositionInput {
  lat: number;
  lng: number;
  accuracy: number;
  recordedAt: string;
}

// ── Batch request/response ─────────────────────────────────────────

export interface PositionBatchInput {
  sessionId: string;
  positions: PositionInput[];
}

export interface PositionBatchResponse {
  inserted: number;
}
