import chalk from "chalk";

import type { SimClock } from "./sim-clock";

export class SimLogger {
  private readonly clock: SimClock;
  private readonly verbose: boolean;

  constructor(clock: SimClock, verbose: boolean) {
    this.clock = clock;
    this.verbose = verbose;
  }

  /** Timestamp prefix in real elapsed time */
  private prefix(): string {
    return chalk.gray(`[${this.clock.formatRealElapsed()}]`);
  }

  /** General info message */
  info(msg: string): void {
    console.log(`${this.prefix()} ${msg}`);
  }

  /** Warning/alert message */
  warn(msg: string): void {
    console.log(`${this.prefix()} ${chalk.yellow("⚠")} ${chalk.yellow(msg)}`);
  }

  /** Error message */
  error(msg: string): void {
    console.log(`${this.prefix()} ${chalk.red("✖")} ${chalk.red(msg)}`);
  }

  /** Success message */
  success(msg: string): void {
    console.log(`${this.prefix()} ${chalk.green("✔")} ${chalk.green(msg)}`);
  }

  /** Verbose-only debug message */
  debug(msg: string): void {
    if (this.verbose) {
      console.log(`${this.prefix()} ${chalk.dim(msg)}`);
    }
  }

  /** Group movement event */
  groupMove(groupIndex: number, hole: number, par: number): void {
    this.info(`Groupe ${groupIndex + 1} → Trou ${hole} (par ${par})`);
  }

  /** Group finished */
  groupFinished(groupIndex: number, simElapsed: string): void {
    this.success(`Groupe ${groupIndex + 1} — terminé (${simElapsed})`);
  }

  /** Group dropped out */
  groupDroppedOut(groupIndex: number, hole: number): void {
    this.warn(`Groupe ${groupIndex + 1} — abandon au trou ${hole}`);
  }

  /** Simulation header */
  header(courseName: string, groupCount: number, speed: number): void {
    console.log(
      `${this.prefix()} ${chalk.bold(`Simulation — ${courseName}, ${groupCount} groupes, ${speed}x`)}`,
    );
  }

  /** Simulation summary */
  summary(holesPlayed: number, simElapsed: string, realElapsed: string): void {
    console.log(
      `${this.prefix()} ${chalk.bold(`Terminé — ${holesPlayed} trous, ${simElapsed} simulées en ${realElapsed}`)}`,
    );
  }

  /** Position emitted (verbose only) */
  position(groupIndex: number, hole: number, lat: number, lng: number): void {
    if (this.verbose) {
      this.debug(`  G${groupIndex + 1} H${hole}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  }
}
