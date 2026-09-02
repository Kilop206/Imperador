export type ToolRiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type ToolParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array';

export interface ToolParameterDefinition {
  name: string;
  description: string;
  type: ToolParameterType;
  required?: boolean;
  defaultValue?: unknown;
}

export interface ToolExecutionContext {
  executionId: string;
  requestedAt: number;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  parameters: ToolParameterDefinition[];
  execute: (
    parameters: Record<string, unknown>,
    context: ToolExecutionContext,
  ) => Promise<unknown> | unknown;
  rollback?: (
    parameters: Record<string, unknown>,
    result: unknown,
    context: ToolExecutionContext,
  ) => Promise<unknown> | unknown;
  enabled?: boolean;
  timeoutMs?: number;
}

export interface ToolExecutionResult {
  executionId: string;
  toolName: string;
  success: boolean;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  result?: unknown;
  error?: string;
  rolledBack?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class ToolRegistry {
  private readonly tools =
    new Map<string, ToolDefinition>();

  private executionCounter = 0;

  public register(
    definition: ToolDefinition,
  ): void {
    this.validateDefinition(
      definition,
    );

    const normalizedName =
      this.normalizeName(
        definition.name,
      );

    if (
      this.tools.has(
        normalizedName,
      )
    ) {
      throw new Error(
        `A ferramenta "${definition.name}" já está registrada.`,
      );
    }

    this.tools.set(
      normalizedName,
      {
        ...definition,
        name: normalizedName,
        enabled:
          definition.enabled ?? true,
        parameters:
          definition.parameters.map(
            parameter => ({
              ...parameter,
            }),
          ),
        timeoutMs:
          this.normalizeTimeout(
            definition.timeoutMs,
          ),
      },
    );
  }

  public unregister(
    toolName: string,
  ): boolean {
    return this.tools.delete(
      this.normalizeName(
        toolName,
      ),
    );
  }

  public get(
    toolName: string,
  ): ToolDefinition | null {
    const tool =
      this.tools.get(
        this.normalizeName(
          toolName,
        ),
      );

    if (!tool) {
      return null;
    }

    return this.cloneDefinition(
      tool,
    );
  }

  public has(
    toolName: string,
  ): boolean {
    return this.tools.has(
      this.normalizeName(
        toolName,
      ),
    );
  }

  public list(
    options: {
      includeDisabled?: boolean;
      maximumRisk?: ToolRiskLevel;
    } = {},
  ): ToolDefinition[] {
    const includeDisabled =
      options.includeDisabled ??
      false;

    const maximumRisk =
      options.maximumRisk;

    const maximumRiskValue =
      maximumRisk
        ? this.getRiskValue(
            maximumRisk,
          )
        : Number.POSITIVE_INFINITY;

    return Array.from(
      this.tools.values(),
    )
      .filter(
        tool =>
          (
            includeDisabled ||
            tool.enabled !== false
          ) &&
          this.getRiskValue(
            tool.riskLevel,
          ) <= maximumRiskValue,
      )
      .map(
        tool =>
          this.cloneDefinition(
            tool,
          ),
      );
  }

  public setEnabled(
    toolName: string,
    enabled: boolean,
  ): boolean {
    const tool =
      this.tools.get(
        this.normalizeName(
          toolName,
        ),
      );

    if (!tool) {
      return false;
    }

    tool.enabled = enabled;

    return true;
  }

  public validateParameters(
    toolName: string,
    parameters: Record<string, unknown>,
  ): {
    valid: boolean;
    errors: string[];
  } {
    const tool =
      this.tools.get(
        this.normalizeName(
          toolName,
        ),
      );

    if (!tool) {
      return {
        valid: false,
        errors: [
          `Ferramenta "${toolName}" não encontrada.`,
        ],
      };
    }

    if (
      !parameters ||
      typeof parameters !== 'object' ||
      Array.isArray(parameters)
    ) {
      return {
        valid: false,
        errors: [
          'Os parâmetros devem ser um objeto.',
        ],
      };
    }

    const errors: string[] = [];

    for (
      const definition of
      tool.parameters
    ) {
      const value =
        parameters[
          definition.name
        ];

      const missing =
        value === undefined ||
        value === null;

      if (
        missing &&
        definition.required
      ) {
        errors.push(
          `Parâmetro obrigatório ausente: "${definition.name}".`,
        );

        continue;
      }

      if (missing) {
        continue;
      }

      if (
        !this.matchesType(
          value,
          definition.type,
        )
      ) {
        errors.push(
          `Parâmetro "${definition.name}" deveria ser do tipo "${definition.type}".`,
        );
      }
    }

    return {
      valid:
        errors.length === 0,
      errors,
    };
  }

  public async execute(
    toolName: string,
    parameters:
      Record<string, unknown> = {},
    contextOverrides: {
      source?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<ToolExecutionResult> {
    const normalizedName =
      this.normalizeName(
        toolName,
      );

    const tool =
      this.tools.get(
        normalizedName,
      );

    const executionId =
      this.createExecutionId(
        normalizedName,
      );

    const startedAt =
      Date.now();

    if (!tool) {
      return {
        executionId,
        toolName: normalizedName,
        success: false,
        startedAt,
        finishedAt: Date.now(),
        durationMs:
          Date.now() -
          startedAt,
        error:
          `Ferramenta "${toolName}" não encontrada.`,
      };
    }

    if (
      tool.enabled === false
    ) {
      return {
        executionId,
        toolName: normalizedName,
        success: false,
        startedAt,
        finishedAt: Date.now(),
        durationMs:
          Date.now() -
          startedAt,
        error:
          `Ferramenta "${normalizedName}" está desativada.`,
      };
    }

    const validation =
      this.validateParameters(
        normalizedName,
        parameters,
      );

    if (!validation.valid) {
      return {
        executionId,
        toolName: normalizedName,
        success: false,
        startedAt,
        finishedAt: Date.now(),
        durationMs:
          Date.now() -
          startedAt,
        error:
          validation.errors.join(
            ' ',
          ),
      };
    }

    const resolvedParameters =
      this.applyDefaults(
        tool.parameters,
        parameters,
      );

    const context:
      ToolExecutionContext = {
      executionId,
      requestedAt:
        startedAt,
      source:
        contextOverrides.source ??
        'unknown',
      metadata:
        contextOverrides.metadata,
    };

    try {
      const result =
        await this.executeWithTimeout(
          () =>
            tool.execute(
              resolvedParameters,
              context,
            ),
          tool.timeoutMs ??
            DEFAULT_TIMEOUT_MS,
        );

      const finishedAt =
        Date.now();

      return {
        executionId,
        toolName: normalizedName,
        success: true,
        startedAt,
        finishedAt,
        durationMs:
          finishedAt -
          startedAt,
        result,
        rolledBack: false,
      };
    } catch (error) {
      const finishedAt =
        Date.now();

      return {
        executionId,
        toolName: normalizedName,
        success: false,
        startedAt,
        finishedAt,
        durationMs:
          finishedAt -
          startedAt,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        rolledBack: false,
      };
    }
  }

  public async rollback(
    toolName: string,
    parameters:
      Record<string, unknown> = {},
    result: unknown,
    contextOverrides: {
      source?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<ToolExecutionResult> {
    const normalizedName =
      this.normalizeName(
        toolName,
      );

    const tool =
      this.tools.get(
        normalizedName,
      );

    const executionId =
      this.createExecutionId(
        `${normalizedName}-rollback`,
      );

    const startedAt =
      Date.now();

    if (!tool) {
      return {
        executionId,
        toolName: normalizedName,
        success: false,
        startedAt,
        finishedAt: Date.now(),
        durationMs:
          Date.now() -
          startedAt,
        error:
          `Ferramenta "${toolName}" não encontrada.`,
      };
    }

    if (!tool.rollback) {
      return {
        executionId,
        toolName: normalizedName,
        success: false,
        startedAt,
        finishedAt: Date.now(),
        durationMs:
          Date.now() -
          startedAt,
        error:
          `A ferramenta "${normalizedName}" não possui rollback.`,
      };
    }

    const validation =
      this.validateParameters(
        normalizedName,
        parameters,
      );

    if (!validation.valid) {
      return {
        executionId,
        toolName: normalizedName,
        success: false,
        startedAt,
        finishedAt: Date.now(),
        durationMs:
          Date.now() -
          startedAt,
        error:
          validation.errors.join(
            ' ',
          ),
      };
    }

    const context:
      ToolExecutionContext = {
      executionId,
      requestedAt:
        startedAt,
      source:
        contextOverrides.source ??
        'rollback',
      metadata:
        contextOverrides.metadata,
    };

    try {
      const rollbackResult =
        await this.executeWithTimeout(
          () =>
            tool.rollback!(
              this.applyDefaults(
                tool.parameters,
                parameters,
              ),
              result,
              context,
            ),
          tool.timeoutMs ??
            DEFAULT_TIMEOUT_MS,
        );

      const finishedAt =
        Date.now();

      return {
        executionId,
        toolName: normalizedName,
        success: true,
        startedAt,
        finishedAt,
        durationMs:
          finishedAt -
          startedAt,
        result:
          rollbackResult,
        rolledBack: true,
      };
    } catch (error) {
      const finishedAt =
        Date.now();

      return {
        executionId,
        toolName: normalizedName,
        success: false,
        startedAt,
        finishedAt,
        durationMs:
          finishedAt -
          startedAt,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        rolledBack: false,
      };
    }
  }

  public getToolCount(): number {
    return this.tools.size;
  }

  public getRiskLevel(
    toolName: string,
  ): ToolRiskLevel | null {
    const tool =
      this.tools.get(
        this.normalizeName(
          toolName,
        ),
      );

    return tool?.riskLevel ??
      null;
  }

  public clear(): void {
    this.tools.clear();
  }

  private validateDefinition(
    definition: ToolDefinition,
  ): void {
    if (
      !definition ||
      typeof definition !== 'object'
    ) {
      throw new TypeError(
        'Definição de ferramenta inválida.',
      );
    }

    if (
      typeof definition.name !==
        'string' ||
      !definition.name.trim()
    ) {
      throw new TypeError(
        'A ferramenta precisa possuir um nome válido.',
      );
    }

    if (
      typeof definition.description !==
        'string' ||
      !definition.description.trim()
    ) {
      throw new TypeError(
        `A ferramenta "${definition.name}" precisa possuir uma descrição.`,
      );
    }

    if (
      definition.riskLevel !== 'low' &&
      definition.riskLevel !== 'medium' &&
      definition.riskLevel !== 'high' &&
      definition.riskLevel !== 'critical'
    ) {
      throw new TypeError(
        `Nível de risco inválido para a ferramenta "${definition.name}".`,
      );
    }

    if (
      !Array.isArray(
        definition.parameters,
      )
    ) {
      throw new TypeError(
        `Os parâmetros da ferramenta "${definition.name}" devem ser um array.`,
      );
    }

    if (
      typeof definition.execute !==
      'function'
    ) {
      throw new TypeError(
        `A ferramenta "${definition.name}" precisa possuir um executor.`,
      );
    }

    for (
      const parameter of
      definition.parameters
    ) {
      this.validateParameterDefinition(
        definition.name,
        parameter,
      );
    }

    if (
      definition.rollback !==
        undefined &&
      typeof definition.rollback !==
        'function'
    ) {
      throw new TypeError(
        `O rollback da ferramenta "${definition.name}" deve ser uma função.`,
      );
    }
  }

  private validateParameterDefinition(
    toolName: string,
    parameter: ToolParameterDefinition,
  ): void {
    const validTypes:
      ToolParameterType[] = [
      'string',
      'number',
      'boolean',
      'object',
      'array',
    ];

    if (
      !parameter ||
      typeof parameter.name !==
        'string' ||
      !parameter.name.trim()
    ) {
      throw new TypeError(
        `A ferramenta "${toolName}" possui um parâmetro sem nome válido.`,
      );
    }

    if (
      typeof parameter.description !==
        'string'
    ) {
      throw new TypeError(
        `O parâmetro "${parameter.name}" da ferramenta "${toolName}" precisa possuir uma descrição.`,
      );
    }

    if (
      !validTypes.includes(
        parameter.type,
      )
    ) {
      throw new TypeError(
        `Tipo inválido para o parâmetro "${parameter.name}" da ferramenta "${toolName}".`,
      );
    }
  }

  private matchesType(
    value: unknown,
    type: ToolParameterType,
  ): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';

      case 'number':
        return (
          typeof value === 'number' &&
          Number.isFinite(value)
        );

      case 'boolean':
        return typeof value === 'boolean';

      case 'object':
        return (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        );

      case 'array':
        return Array.isArray(
          value,
        );
    }
  }

  private applyDefaults(
    definitions:
      ToolParameterDefinition[],
    parameters:
      Record<string, unknown>,
  ): Record<string, unknown> {
    const result = {
      ...parameters,
    };

    for (
      const definition of
      definitions
    ) {
      if (
        result[
          definition.name
        ] === undefined &&
        definition.defaultValue !==
          undefined
      ) {
        result[
          definition.name
        ] =
          definition.defaultValue;
      }
    }

    return result;
  }

  private async executeWithTimeout<T>(
    executor: () =>
      Promise<T> | T,
    timeoutMs: number,
  ): Promise<T> {
    return await new Promise<T>(
      (
        resolve,
        reject,
      ) => {
        let settled = false;

        const timeout =
          setTimeout(
            () => {
              if (settled) {
                return;
              }

              settled = true;

              reject(
                new Error(
                  `Execução excedeu o timeout de ${timeoutMs} ms.`,
                ),
              );
            },
            timeoutMs,
          );

        Promise.resolve()
          .then(
            () => executor(),
          )
          .then(
            value => {
              if (settled) {
                return;
              }

              settled = true;
              clearTimeout(
                timeout,
              );

              resolve(value);
            },
            error => {
              if (settled) {
                return;
              }

              settled = true;
              clearTimeout(
                timeout,
              );

              reject(error);
            },
          );
      },
    );
  }

  private normalizeName(
    name: string,
  ): string {
    return name
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        '_',
      );
  }

  private normalizeTimeout(
    timeoutMs:
      | number
      | undefined,
  ): number {
    if (
      timeoutMs === undefined ||
      !Number.isFinite(
        timeoutMs,
      ) ||
      timeoutMs <= 0
    ) {
      return DEFAULT_TIMEOUT_MS;
    }

    return Math.floor(
      timeoutMs,
    );
  }

  private createExecutionId(
    toolName: string,
  ): string {
    this.executionCounter += 1;

    return `tool_${toolName}_${Date.now()}_${this.executionCounter}`;
  }

  private cloneDefinition(
    definition: ToolDefinition,
  ): ToolDefinition {
    return {
      ...definition,
      parameters:
        definition.parameters.map(
          parameter => ({
            ...parameter,
          }),
        ),
    };
  }

  private getRiskValue(
    riskLevel: ToolRiskLevel,
  ): number {
    switch (riskLevel) {
      case 'low':
        return 1;

      case 'medium':
        return 2;

      case 'high':
        return 3;

      case 'critical':
        return 4;
    }
  }
}