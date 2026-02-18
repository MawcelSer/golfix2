/** Position event emitted by the internal simulation engine */
export interface PositionEvent {
  readonly sessionId: string;
  readonly lat: number;
  readonly lng: number;
  readonly accuracy: number;
  readonly recordedAt: Date;
  readonly hole: number;
  readonly groupIndex: number;
}
