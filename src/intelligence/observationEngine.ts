import type {
  ToolExecutionResult,
} from './toolRegistry';

export type ObservationSource =
  | 'tool'
  | 'system'
  | 'user'
  | 'agent';

export type ObservationType =
  | 'execution'
  | 'system'
  | 'user_interaction'
  | 'anomaly'
  | 'metric';

export type ObservationSignificance =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface Observation {
  id: string;
  timestamp: number;
  source: ObservationSource;
  type: ObservationType;
  executionId?: string;
  toolName?: string;
  success?: boolean;
  summary: string;
  data?: Record<string, unknown>;
  metrics?: Record<string, number>;
  anomalies: string[];
  significance: ObservationSignificance;
}

export interface ObserveExecutionOptions {
  significance?: ObservationSignificance;
  summary?: string;
  anomalies?: string[];
  data?: Record<string, unknown>;
  metrics?: Record<string, number>;
}

export interface ObserveSystemOptions {
  summary: string;
  significance?: ObservationSignificance;
  anomalies?: string[];
  data?: Record<string, unknown>;
  metrics?: Record<string, number>;
}

export interface ObserveUserInteractionOptions {
  summary: string;
  significance?: ObservationSignificance;
  data?: Record<string, unknown>;
  metrics?: Record<string, number>;
}

export interface ObservationQuery {
  source?: ObservationSource;
  type?: ObservationType;
  significance?: ObservationSignificance;
  success?: boolean;
  executionId?: string;
  toolName?: string;
  since?: number;
  until?: number;
  limit?: number;
}

export interface ObservationAggregate {
  total: number;
  successful: number;
  failed: number;
  anomalies: number;
  bySource: Record<
    ObservationSource,
    number
  >;
  byType: Record<
    ObservationType,
    number
  >;
  bySignificance: Record<
    ObservationSignificance,
    number
  >;
  successRate: number;
}

export interface ObservationRuntimeStatus {
  enabled: boolean;
  totalObservations: number;
  maximumObservations: number;
  oldestObservationTimestamp:
    number | null;
  newestObservationTimestamp:
    number | null;
  anomalyCount: number;
  highSignificanceCount: number;
  criticalSignificanceCount: number;
}

const DEFAULT_MAXIMUM_OBSERVATIONS = 500;

const DEFAULT_STRING_LIMIT = 1_000;

const DEFAULT_DATA_DEPTH = 4;

export class ObservationEngine {
  private readonly observations: Observation[] = [];

  private readonly maximumObservations: number;

  private enabled = true;

  private observationCounter = 0;

  public constructor(
    maximumObservations =
      DEFAULT_MAXIMUM_OBSERVATIONS,
  ) {
    if (
      !Number.isFinite(
        maximumObservations,
      ) ||
      maximumObservations <= 0
    ) {
      throw new RangeError(
        'maximumObservations deve ser maior que zero.',
      );
    }

    this.maximumObservations =
      Math.floor(
        maximumObservations,
      );
  }

  public observeExecution(
    execution: ToolExecutionResult,
    options: ObserveExecutionOptions = {},
  ): Observation {
    if (!execution) {
      throw new TypeError(
        'execution é obrigatório.',
      );
    }

    const anomalies = [
      ...(options.anomalies ?? []),
    ];

    if (!execution.success) {
      anomalies.push(
        'A execução da ferramenta falhou.',
      );
    }

    if (
      execution.durationMs >=
      30_000
    ) {
      anomalies.push(
        'A execução apresentou duração elevada.',
      );
    }

    const summary =
      options.summary ??
      this.buildExecutionSummary(
        execution,
      );

    const significance =
      options.significance ??
      this.inferExecutionSignificance(
        execution,
        anomalies,
      );

    const observation: Observation =
      this.createObservation({
        source: 'tool',
        type: 'execution',
        executionId:
          execution.executionId,
        toolName:
          execution.toolName,
        success:
          execution.success,
        summary,
        data: {
          ...(options.data ?? {}),
          durationMs:
            execution.durationMs,
          ...(execution.error
            ? {
                error:
                  execution.error,
              }
            : {}),
        },
        metrics: {
          ...(options.metrics ?? {}),
          durationMs:
            execution.durationMs,
        },
        anomalies,
        significance,
      });

    return this.store(
      observation,
    );
  }

  public observeSystem(
    options: ObserveSystemOptions,
  ): Observation {
    if (!options) {
      throw new TypeError(
        'options é obrigatório.',
      );
    }

    const anomalies = [
      ...(options.anomalies ?? []),
    ];

    const observation: Observation =
      this.createObservation({
        source: 'system',
        type:
          anomalies.length > 0
            ? 'anomaly'
            : 'system',
        summary:
          options.summary,
        data:
          options.data,
        metrics:
          options.metrics,
        anomalies,
        significance:
          options.significance ??
          (
            anomalies.length > 0
              ? 'medium'
              : 'low'
          ),
      });

    return this.store(
      observation,
    );
  }

  public observeUserInteraction(
    options: ObserveUserInteractionOptions,
  ): Observation {
    if (!options) {
      throw new TypeError(
        'options é obrigatório.',
      );
    }

    const observation: Observation =
      this.createObservation({
        source: 'user',
        type: 'user_interaction',
        summary:
          options.summary,
        data:
          options.data,
        metrics:
          options.metrics,
        anomalies: [],
        significance:
          options.significance ??
          'low',
      });

    return this.store(
      observation,
    );
  }

  public observeAgent(
    summary: string,
    options: {
      significance?: ObservationSignificance;
      data?: Record<
        string,
        unknown
      >;
      metrics?: Record<
        string,
        number
      >;
      anomalies?: string[];
    } = {},
  ): Observation {
    const observation =
      this.createObservation({
        source: 'agent',
        type: 'system',
        summary,
        data:
          options.data,
        metrics:
          options.metrics,
        anomalies:
          options.anomalies ?? [],
        significance:
          options.significance ??
          'low',
      });

    return this.store(
      observation,
    );
  }

  public get(
    observationId: string,
  ): Observation | null {
    const observation =
      this.observations.find(
        item =>
          item.id ===
          observationId,
      );

    return observation
      ? this.cloneObservation(
          observation,
        )
      : null;
  }

  public getRecent(
    limit = 20,
  ): Observation[] {
    const normalizedLimit =
      this.normalizeLimit(
        limit,
      );

    return this.observations
      .slice(
        -normalizedLimit,
      )
      .reverse()
      .map(
        observation =>
          this.cloneObservation(
            observation,
          ),
      );
  }

  public query(
    options: ObservationQuery = {},
  ): Observation[] {
    const limit =
      options.limit === undefined
        ? this.maximumObservations
        : this.normalizeLimit(
            options.limit,
          );

    return this.observations
      .filter(
        observation =>
          this.matchesQuery(
            observation,
            options,
          ),
      )
      .slice(-limit)
      .reverse()
      .map(
        observation =>
          this.cloneObservation(
            observation,
          ),
      );
  }

  public getByExecutionId(
    executionId: string,
  ): Observation[] {
    return this.query({
      executionId,
    });
  }

  public getByToolName(
    toolName: string,
  ): Observation[] {
    return this.query({
      toolName,
    });
  }

  public getByType(
    type: ObservationType,
  ): Observation[] {
    return this.query({
      type,
    });
  }

  public getBySignificance(
    significance: ObservationSignificance,
  ): Observation[] {
    return this.query({
      significance,
    });
  }

  public getAggregate(
    options: Omit<
      ObservationQuery,
      'limit'
    > = {},
  ): ObservationAggregate {
    const selected =
      this.observations.filter(
        observation =>
          this.matchesQuery(
            observation,
            options,
          ),
      );

    const bySource =
      this.createSourceCounter();

    const byType =
      this.createTypeCounter();

    const bySignificance =
      this.createSignificanceCounter();

    let successful = 0;
    let failed = 0;
    let anomalies = 0;

    for (
      const observation of
      selected
    ) {
      bySource[
        observation.source
      ] += 1;

      byType[
        observation.type
      ] += 1;

      bySignificance[
        observation.significance
      ] += 1;

      if (
        observation.success === true
      ) {
        successful += 1;
      }

      if (
        observation.success === false
      ) {
        failed += 1;
      }

      if (
        observation.anomalies.length >
        0
      ) {
        anomalies += 1;
      }
    }

    const executions =
      successful + failed;

    return {
      total:
        selected.length,
      successful,
      failed,
      anomalies,
      bySource,
      byType,
      bySignificance,
      successRate:
        executions === 0
          ? 0
          : successful /
            executions,
    };
  }

  public getStatus():
    ObservationRuntimeStatus {
    const oldest =
      this.observations[0];

    const newest =
      this.observations[
        this.observations.length -
          1
      ];

    let anomalyCount = 0;
    let highSignificanceCount =
      0;
    let criticalSignificanceCount =
      0;

    for (
      const observation of
      this.observations
    ) {
      if (
        observation.anomalies.length >
        0
      ) {
        anomalyCount += 1;
      }

      if (
        observation.significance ===
        'high'
      ) {
        highSignificanceCount +=
          1;
      }

      if (
        observation.significance ===
        'critical'
      ) {
        criticalSignificanceCount +=
          1;
      }
    }

    return {
      enabled:
        this.enabled,
      totalObservations:
        this.observations.length,
      maximumObservations:
        this.maximumObservations,
      oldestObservationTimestamp:
        oldest?.timestamp ??
        null,
      newestObservationTimestamp:
        newest?.timestamp ??
        null,
      anomalyCount,
      highSignificanceCount,
      criticalSignificanceCount,
    };
  }

  public setEnabled(
    enabled: boolean,
  ): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public clear(): void {
    this.observations.length = 0;
  }

  private store(
    observation: Observation,
  ): Observation {
    if (!this.enabled) {
      return this.cloneObservation(
        observation,
      );
    }

    this.observations.push(
      observation,
    );

    while (
      this.observations.length >
      this.maximumObservations
    ) {
      this.observations.shift();
    }

    return this.cloneObservation(
      observation,
    );
  }

  private createObservation(
    input: Omit<
      Observation,
      'id' | 'timestamp'
    >,
  ): Observation {
    const rawData = input.data;

    return {
      id: this.createObservationId(),
      timestamp: Date.now(),
      source: input.source,
      type: input.type,
      ...(input.executionId
        ? {
            executionId:
              input.executionId,
          }
        : {}),
      ...(input.toolName
        ? {
            toolName:
              input.toolName,
          }
        : {}),
      ...(input.success !== undefined
        ? {
            success:
              input.success,
          }
        : {}),
      summary:
        this.sanitizeString(
          input.summary,
        ),
      ...(rawData
        ? {
            data:
              this.sanitizeData(
                rawData,
                DEFAULT_DATA_DEPTH,
              ) as Record<
                string,
                unknown
              >,
          }
        : {}),
      ...(input.metrics
        ? {
            metrics:
              this.sanitizeMetrics(
                input.metrics,
              ),
          }
        : {}),
      anomalies:
        input.anomalies
          .filter(
            anomaly =>
              typeof anomaly ===
              'string',
          )
          .map(
            anomaly =>
              this.sanitizeString(
                anomaly,
              ),
          ),
      significance:
        input.significance,
    };
  }

  private createObservationId():
    string {
    this.observationCounter += 1;

    return `observation_${Date.now()}_${this.observationCounter}`;
  }

  private buildExecutionSummary(
    execution: ToolExecutionResult,
  ): string {
    if (execution.success) {
      return `Ferramenta "${execution.toolName}" executada com sucesso em ${execution.durationMs} ms.`;
    }

    return `Ferramenta "${execution.toolName}" falhou após ${execution.durationMs} ms.`;
  }

  private inferExecutionSignificance(
    execution: ToolExecutionResult,
    anomalies: string[],
  ): ObservationSignificance {
    if (!execution.success) {
      return 'high';
    }

    if (
      anomalies.length > 0
    ) {
      return 'medium';
    }

    return 'low';
  }

  private matchesQuery(
    observation: Observation,
    options: ObservationQuery,
  ): boolean {
    if (
      options.source &&
      observation.source !==
        options.source
    ) {
      return false;
    }

    if (
      options.type &&
      observation.type !==
        options.type
    ) {
      return false;
    }

    if (
      options.significance &&
      observation.significance !==
        options.significance
    ) {
      return false;
    }

    if (
      options.success !== undefined &&
      observation.success !==
        options.success
    ) {
      return false;
    }

    if (
      options.executionId &&
      observation.executionId !==
        options.executionId
    ) {
      return false;
    }

    if (
      options.toolName &&
      observation.toolName !==
        options.toolName
    ) {
      return false;
    }

    if (
      options.since !== undefined &&
      observation.timestamp <
        options.since
    ) {
      return false;
    }

    if (
      options.until !== undefined &&
      observation.timestamp >
        options.until
    ) {
      return false;
    }

    return true;
  }

  private normalizeLimit(
    limit: number,
  ): number {
    if (
      !Number.isFinite(limit) ||
      limit <= 0
    ) {
      return 1;
    }

    return Math.min(
      Math.floor(limit),
      this.maximumObservations,
    );
  }

  private sanitizeString(
    value: string,
  ): string {
    return value
      .slice(
        0,
        DEFAULT_STRING_LIMIT,
      );
  }

  private sanitizeData(
    value: unknown,
    remainingDepth: number,
  ): unknown {
    /*
     * O limite é aplicado ao conteúdo abaixo
     * do nível permitido, não ao próprio objeto
     * que atingiu remainingDepth === 0.
     */
    if (
      remainingDepth < 0
    ) {
      return '[depth-limit]';
    }

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'number'
    ) {
      if (
        typeof value === 'string'
      ) {
        return this.sanitizeString(
          value,
        );
      }

      if (
        typeof value === 'number' &&
        !Number.isFinite(value)
      ) {
        return null;
      }

      return value;
    }

    if (
      value instanceof Date
    ) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 50)
        .map(item =>
          this.sanitizeData(
            item,
            remainingDepth - 1,
          ),
        );
    }

    if (
      typeof value === 'object'
    ) {
      const object =
        value as Record<
          string,
          unknown
        >;

      const result:
        Record<
          string,
          unknown
        > = {};

      const keys =
        Object.keys(object)
          .slice(0, 50);

      for (
        const key of keys
      ) {
        result[
          this.sanitizeString(
            key,
          )
        ] =
          this.sanitizeData(
            object[key],
            remainingDepth - 1,
          );
      }

      return result;
    }

    return String(value);
  }

  private sanitizeMetrics(
    metrics: Record<
      string,
      number
    >,
  ): Record<
    string,
    number
  > {
    const result:
      Record<string, number> =
      {};

    for (
      const [key, value] of
      Object.entries(metrics)
    ) {
      if (
        !Number.isFinite(value)
      ) {
        continue;
      }

      result[
        this.sanitizeString(
          key,
        )
      ] = value;
    }

    return result;
  }

  private createSourceCounter():
    Record<
      ObservationSource,
      number
    > {
    return {
      tool: 0,
      system: 0,
      user: 0,
      agent: 0,
    };
  }

  private createTypeCounter():
    Record<
      ObservationType,
      number
    > {
    return {
      execution: 0,
      system: 0,
      user_interaction: 0,
      anomaly: 0,
      metric: 0,
    };
  }

  private createSignificanceCounter():
    Record<
      ObservationSignificance,
      number
    > {
    return {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
  }

  private cloneObservation(
    observation: Observation,
  ): Observation {
    return {
      ...observation,
      ...(observation.data
        ? {
            data:
              this.cloneValue(
                observation.data,
              ) as Record<
                string,
                unknown
              >,
          }
        : {}),
      ...(observation.metrics
        ? {
            metrics:
              {
                ...observation.metrics,
              },
          }
        : {}),
      anomalies: [
        ...observation.anomalies,
      ],
    };
  }

  private cloneValue(
    value: unknown,
  ): unknown {
    if (
      value === null ||
      typeof value !== 'object'
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(
        item =>
          this.cloneValue(
            item,
          ),
      );
    }

    const result:
      Record<string, unknown> =
      {};

    for (
      const [key, child] of
      Object.entries(
        value as Record<
          string,
          unknown
        >,
      )
    ) {
      result[key] =
        this.cloneValue(
          child,
        );
    }

    return result;
  }
}