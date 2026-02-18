/**
 * Virtual clock that accelerates time by a configurable speed factor.
 *
 * At speed=30, 1 real second = 30 simulated seconds.
 * A 4h15 round plays in ~8.5 real minutes.
 */
export class SimClock {
  private readonly startReal: number;
  private readonly startSim: Date;
  private readonly speed: number;

  constructor(startTime: Date, speed: number) {
    this.startReal = Date.now();
    this.startSim = startTime;
    this.speed = speed;
  }

  /** Current simulated time */
  now(): Date {
    const realElapsedMs = Date.now() - this.startReal;
    const simElapsedMs = realElapsedMs * this.speed;
    return new Date(this.startSim.getTime() + simElapsedMs);
  }

  /** Simulated milliseconds elapsed since start */
  elapsedMs(): number {
    return this.now().getTime() - this.startSim.getTime();
  }

  /** Real milliseconds needed for a given simulated duration */
  realMsFor(simMs: number): number {
    return simMs / this.speed;
  }

  /** Simulated milliseconds for a given real duration */
  simMsFor(realMs: number): number {
    return realMs * this.speed;
  }

  /** Format elapsed real time as MM:SS */
  formatRealElapsed(): string {
    const realMs = Date.now() - this.startReal;
    const totalSec = Math.floor(realMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  /** Format simulated elapsed time as Xh YYmin */
  formatSimElapsed(): string {
    const simMs = this.elapsedMs();
    const totalMin = Math.floor(simMs / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
  }

  get speedFactor(): number {
    return this.speed;
  }

  get simStartTime(): Date {
    return this.startSim;
  }
}
