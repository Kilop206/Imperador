import type { AIRuntimeGeneratedResponseTrainingResult } from './aiRuntimeService';

export interface GeneratedResponseTrainingRuntimeOptions {
  enabled?: boolean;
  intervalMs?: number;
  batchSize?: number;
  minimumIntervalMs?: number;
  train: (
    limit: number,
  ) => AIRuntimeGeneratedResponseTrainingResult;
}

export interface GeneratedResponseTrainingRuntimeStatus {
  enabled: boolean;
  running: boolean;
  cycleRunning: boolean;
  intervalMs: number;
  batchSize: number;
  minimumIntervalMs: number;
  cycleCount: number;
  skippedCycles: number;
  lastRunAt: number | null;
  lastResult: AIRuntimeGeneratedResponseTrainingResult | null;
  lastError: string | null;
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MINIMUM_INTERVAL_MS = 5 * 60 * 1000;

export class GeneratedResponseTrainingRuntimeService {
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly minimumIntervalMs: number;
  private readonly train: (
    limit: number,
  ) => AIRuntimeGeneratedResponseTrainingResult;

  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private cycleRunning = false;
  private cycleCount = 0;
  private skippedCycles = 0;
  private lastRunAt: number | null = null;
  private lastResult: AIRuntimeGeneratedResponseTrainingResult | null = null;
  private lastError: string | null = null;

  public constructor(
    options: GeneratedResponseTrainingRuntimeOptions,
  ) {
    if (typeof options.train !== 'function') {
      throw new TypeError('Uma função de treinamento é obrigatória.');
    }

    this.enabled = options.enabled ?? false;
    this.intervalMs = this.normalizePositiveInteger(
      options.intervalMs,
      DEFAULT_INTERVAL_MS,
      DEFAULT_MINIMUM_INTERVAL_MS,
    );
    this.batchSize = this.normalizePositiveInteger(
      options.batchSize,
      DEFAULT_BATCH_SIZE,
      1,
    );
    this.minimumIntervalMs = this.normalizePositiveInteger(
      options.minimumIntervalMs,
      DEFAULT_MINIMUM_INTERVAL_MS,
      DEFAULT_MINIMUM_INTERVAL_MS,
    );
    this.train = options.train;
  }

  public start(): boolean {
    if (!this.enabled || this.running) {
      return false;
    }

    this.running = true;
    this.scheduleNext();
    return true;
  }

  public stop(): boolean {
    if (!this.running && !this.timer) {
      return false;
    }

    this.running = false;
    this.clearTimer();
    return true;
  }

  public async runNow(): Promise<AIRuntimeGeneratedResponseTrainingResult | null> {
    if (this.cycleRunning) {
      this.skippedCycles += 1;
      return null;
    }

    const now = Date.now();

    if (
      this.lastRunAt !== null &&
      now - this.lastRunAt < this.minimumIntervalMs
    ) {
      this.skippedCycles += 1;
      return null;
    }

    this.cycleRunning = true;
    this.lastRunAt = now;
    this.lastError = null;

    try {
      const result = this.train(this.batchSize);

      this.lastResult = result;
      this.cycleCount += 1;

      return result;
    } catch (error) {
      this.lastError =
        error instanceof Error
          ? error.message
          : String(error);

      return null;
    } finally {
      this.cycleRunning = false;

      if (this.running) {
        this.scheduleNext();
      }
    }
  }

  public getStatus(): GeneratedResponseTrainingRuntimeStatus {
    return {
      enabled: this.enabled,
      running: this.running,
      cycleRunning: this.cycleRunning,
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
      minimumIntervalMs: this.minimumIntervalMs,
      cycleCount: this.cycleCount,
      skippedCycles: this.skippedCycles,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      lastError: this.lastError,
    };
  }

  private normalizePositiveInteger(
    value: number | undefined,
    fallback: number,
    minimum: number,
  ): number {
    if (!Number.isFinite(value) || value === undefined || value <= 0) {
      return fallback;
    }

    return Math.max(minimum, Math.floor(value));
  }

  private scheduleNext(): void {
    this.clearTimer();

    if (!this.running) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runNow();
    }, this.intervalMs);

    this.timer.unref();
  }

  private clearTimer(): void {
    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }
}
