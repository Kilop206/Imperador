import {
  ToolRegistry,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolRiskLevel,
} from './toolRegistry';

export type SafetyDecision =
  | 'approved'
  | 'denied'
  | 'kill-switch'
  | 'rate-limited'
  | 'budget-exceeded'
  | 'permission-denied';

export type SafetyPermission =
  | 'autonomous-low'
  | 'autonomous-medium'
  | 'human-required'
  | 'disabled';

export interface SafetyPolicy {
  enabled: boolean;

  killSwitchEnabled: boolean;

  maximumAutonomousRisk: ToolRiskLevel;

  highRiskRequiresApproval: boolean;

  criticalRiskRequiresApproval: boolean;

  maximumExecutionsPerWindow: number;

  executionWindowMs: number;

  maximumBudgetPerWindow: number;

  allowSources: readonly string[];

  denySources: readonly string[];
}

export interface SafetyApproval {
  approved: boolean;
  decision: SafetyDecision;
  reason: string;
  riskLevel: ToolRiskLevel | null;
  toolName: string;
  requestedAt: number;
}

export interface SafetyExecutionRecord {
  executionId: string;
  toolName: string;
  riskLevel: ToolRiskLevel | null;
  decision: SafetyDecision;
  source: string;
  startedAt: number;
  finishedAt: number;
  success: boolean;
  budgetCost: number;
  reason: string;
}

export interface SafetyRuntimeStatus {
  enabled: boolean;
  killSwitchEnabled: boolean;
  executionsInWindow: number;
  budgetUsedInWindow: number;
  auditEntries: number;
  maximumAutonomousRisk: ToolRiskLevel;
}

const DEFAULT_POLICY: SafetyPolicy = {
  enabled: true,

  killSwitchEnabled: false,

  maximumAutonomousRisk: 'medium',

  highRiskRequiresApproval: true,

  criticalRiskRequiresApproval: true,

  maximumExecutionsPerWindow: 30,

  executionWindowMs: 60 * 60 * 1000,

  maximumBudgetPerWindow: 100,

  allowSources: [],

  denySources: [],

};

const RISK_ORDER: Record<
  ToolRiskLevel,
  number
> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const MAX_AUDIT_ENTRIES = 1000;

export class SafetyPermissionEngine {
  private readonly registry: ToolRegistry;

  private policy: SafetyPolicy = {
    ...DEFAULT_POLICY,
  };

  private executionTimestamps: number[] = [];

  private budgetEntries:
    Array<{
      timestamp: number;
      cost: number;
    }> = [];

  private auditLog:
    SafetyExecutionRecord[] = [];

  constructor(
    registry: ToolRegistry,
  ) {
    this.registry = registry;
  }

  public getPolicy(): Readonly<SafetyPolicy> {
    return {
      ...this.policy,
      allowSources: [
        ...this.policy.allowSources,
      ],
      denySources: [
        ...this.policy.denySources,
      ],
    };
  }

  public setPolicy(
    policy: Partial<SafetyPolicy>,
  ): void {
    this.policy = {
      ...this.policy,
      ...policy,
    };
  }

  public resetPolicy(): void {
    this.policy = {
      ...DEFAULT_POLICY,
    };
  }

  public enable(): void {
    this.policy.enabled = true;
  }

  public disable(): void {
    this.policy.enabled = false;
  }

  public enableKillSwitch(): void {
    this.policy.killSwitchEnabled = true;
  }

  public disableKillSwitch(): void {
    this.policy.killSwitchEnabled = false;
  }

  public isKillSwitchEnabled(): boolean {
    return this.policy.killSwitchEnabled;
  }

  public getPermissionLevel(
    riskLevel: ToolRiskLevel,
  ): SafetyPermission {
    if (!this.policy.enabled) {
      return 'disabled';
    }

    if (
      riskLevel === 'critical'
    ) {
      return 'human-required';
    }

    if (
      riskLevel === 'high'
    ) {
      return this.policy.highRiskRequiresApproval
        ? 'human-required'
        : this.isRiskWithinAutonomousLimit(
            riskLevel,
          )
          ? 'autonomous-medium'
          : 'human-required';
    }

    if (
      riskLevel === 'medium'
    ) {
      return this.isRiskWithinAutonomousLimit(
        riskLevel,
      )
        ? 'autonomous-medium'
        : 'human-required';
    }

    return this.isRiskWithinAutonomousLimit(
      riskLevel,
    )
      ? 'autonomous-low'
      : 'human-required';
  }

  public authorize(
    toolName: string,
    context: Pick<
      ToolExecutionContext,
      'source'
    > & {
      approvedByHuman?: boolean;
      budgetCost?: number;
      requestedAt?: number;
    },
  ): SafetyApproval {
    const requestedAt =
      context.requestedAt ??
      Date.now();

    const normalizedSource =
      context.source.trim();

    const riskLevel =
      this.registry.getRiskLevel(
        toolName,
      );

    if (!riskLevel) {
      return {
        approved: false,
        decision: 'denied',
        reason:
          `Ferramenta "${toolName}" não está registrada.`,
        riskLevel: null,
        toolName,
        requestedAt,
      };
    }

    if (!this.policy.enabled) {
      return {
        approved: false,
        decision: 'denied',
        reason:
          'Safety & Permission Engine está desativado.',
        riskLevel,
        toolName,
        requestedAt,
      };
    }

    if (
      this.policy.killSwitchEnabled
    ) {
      return {
        approved: false,
        decision: 'kill-switch',
        reason:
          'Kill switch de segurança está ativo.',
        riskLevel,
        toolName,
        requestedAt,
      };
    }

    if (
      this.isSourceDenied(
        normalizedSource,
      )
    ) {
      return {
        approved: false,
        decision:
          'permission-denied',
        reason:
          `A origem "${normalizedSource}" está explicitamente bloqueada.`,
        riskLevel,
        toolName,
        requestedAt,
      };
    }

    if (
      this.policy.allowSources.length >
      0 &&
      !this.policy.allowSources.includes(
        normalizedSource,
      )
    ) {
      return {
        approved: false,
        decision:
          'permission-denied',
        reason:
          `A origem "${normalizedSource}" não possui permissão explícita.`,
        riskLevel,
        toolName,
        requestedAt,
      };
    }

    const permission =
      this.getPermissionLevel(
        riskLevel,
      );

    if (
      permission ===
      'human-required' &&
      !context.approvedByHuman
    ) {
      return {
        approved: false,
        decision:
          'permission-denied',
        reason:
          `A ferramenta "${toolName}" possui risco "${riskLevel}" e exige aprovação humana.`,
        riskLevel,
        toolName,
        requestedAt,
      };
    }

    if (
      !context.approvedByHuman &&
      !this.isRiskWithinAutonomousLimit(
        riskLevel,
      )
    ) {
      return {
        approved: false,
        decision:
          'permission-denied',
        reason:
          `O risco "${riskLevel}" excede o limite autônomo "${this.policy.maximumAutonomousRisk}".`,
        riskLevel,
        toolName,
        requestedAt,
      };
    }

    this.pruneExpiredEntries(
      requestedAt,
    );

    if (
      this.executionTimestamps.length >=
      this.policy.maximumExecutionsPerWindow
    ) {
      return {
        approved: false,
        decision:
          'rate-limited',
        reason:
          `Limite de ${this.policy.maximumExecutionsPerWindow} execuções por janela atingido.`,
        riskLevel,
        toolName,
        requestedAt,
      };
    }

    const budgetCost =
      this.normalizeBudgetCost(
        context.budgetCost,
      );

    const currentBudget =
      this.getBudgetUsed(
        requestedAt,
      );

    if (
      currentBudget +
      budgetCost >
      this.policy.maximumBudgetPerWindow
    ) {
      return {
        approved: false,
        decision:
          'budget-exceeded',
        reason:
          `Orçamento de segurança excedido: ${currentBudget + budgetCost}/${this.policy.maximumBudgetPerWindow}.`,
        riskLevel,
        toolName,
        requestedAt,
      };
    }

    return {
      approved: true,
      decision: 'approved',
      reason:
        `Execução autorizada para ferramenta "${toolName}" com risco "${riskLevel}".`,
      riskLevel,
      toolName,
      requestedAt,
    };
  }

  public async execute(
    toolName: string,
    parameters:
      Record<string, unknown> = {},
    context: {
      source: string;
      approvedByHuman?: boolean;
      budgetCost?: number;
      metadata?: Record<string, unknown>;
      requestedAt?: number;
    },
  ): Promise<ToolExecutionResult> {
    const requestedAt =
      context.requestedAt ??
      Date.now();

    const approval =
      this.authorize(
        toolName,
        context,
      );

    if (!approval.approved) {
      const executionId =
        `denied_${Date.now()}_${Math.floor(
          Math.random() * 100000,
        )}`;

      const finishedAt =
        Date.now();

      const result:
        ToolExecutionResult = {
        executionId,
        toolName:
          toolName
            .trim()
            .toLowerCase(),
        success: false,
        startedAt:
          requestedAt,
        finishedAt,
        durationMs:
          finishedAt -
          requestedAt,
        error:
          approval.reason,
        rolledBack: false,
      };

      this.recordAudit({
        executionId,
        toolName:
          toolName
            .trim()
            .toLowerCase(),
        riskLevel:
          approval.riskLevel,
        decision:
          approval.decision,
        source:
          context.source,
        startedAt:
          requestedAt,
        finishedAt,
        success: false,
        budgetCost:
          0,
        reason:
          approval.reason,
      });

      return result;
    }

    this.pruneExpiredEntries(
      requestedAt,
    );

    const budgetCost =
      this.normalizeBudgetCost(
        context.budgetCost,
      );

    this.executionTimestamps.push(
      requestedAt,
    );

    this.budgetEntries.push({
      timestamp:
        requestedAt,
      cost:
        budgetCost,
    });

    const result =
      await this.registry.execute(
        toolName,
        parameters,
        {
          source:
            context.source,
          metadata:
            context.metadata,
        },
      );

    this.recordAudit({
      executionId:
        result.executionId,
      toolName:
        result.toolName,
      riskLevel:
        approval.riskLevel,
      decision:
        result.success
          ? 'approved'
          : 'denied',
      source:
        context.source,
      startedAt:
        result.startedAt,
      finishedAt:
        result.finishedAt,
      success:
        result.success,
      budgetCost,
      reason:
        result.success
          ? approval.reason
          : result.error ??
            'Ferramenta falhou durante execução.',
    });

    return result;
  }

  public getAuditLog(): SafetyExecutionRecord[] {
    return this.auditLog.map(
      entry => ({
        ...entry,
      }),
    );
  }

  public getRecentAuditLog(
    limit = 20,
  ): SafetyExecutionRecord[] {
    const safeLimit =
      Math.max(
        1,
        Math.floor(
          limit,
        ),
      );

    return this.auditLog
      .slice(
        -safeLimit,
      )
      .map(
        entry => ({
          ...entry,
        }),
      );
  }

  public getStatus(
    currentTime = Date.now(),
  ): SafetyRuntimeStatus {
    this.pruneExpiredEntries(
      currentTime,
    );

    return {
      enabled:
        this.policy.enabled,

      killSwitchEnabled:
        this.policy.killSwitchEnabled,

      executionsInWindow:
        this.executionTimestamps.length,

      budgetUsedInWindow:
        this.getBudgetUsed(
          currentTime,
        ),

      auditEntries:
        this.auditLog.length,

      maximumAutonomousRisk:
        this.policy
          .maximumAutonomousRisk,
    };
  }

  public resetRuntimeState(): void {
    this.executionTimestamps = [];
    this.budgetEntries = [];
    this.auditLog = [];
  }

  private isRiskWithinAutonomousLimit(
    riskLevel: ToolRiskLevel,
  ): boolean {
    return (
      RISK_ORDER[riskLevel] <=
      RISK_ORDER[
        this.policy
          .maximumAutonomousRisk
      ]
    );
  }

  private isSourceDenied(
    source: string,
  ): boolean {
    return this.policy.denySources.includes(
      source,
    );
  }

  private normalizeBudgetCost(
    value:
      | number
      | undefined,
  ): number {
    if (
      value === undefined ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      return 0;
    }

    return value;
  }

  private pruneExpiredEntries(
    currentTime: number,
  ): void {
    const minimumTime =
      currentTime -
      this.policy.executionWindowMs;

    this.executionTimestamps =
      this.executionTimestamps.filter(
        timestamp =>
          timestamp >=
          minimumTime,
      );

    this.budgetEntries =
      this.budgetEntries.filter(
        entry =>
          entry.timestamp >=
          minimumTime,
      );
  }

  private getBudgetUsed(
    currentTime: number,
  ): number {
    this.pruneExpiredEntries(
      currentTime,
    );

    return this.budgetEntries.reduce(
      (total, entry) =>
        total + entry.cost,
      0,
    );
  }

  private recordAudit(
    record: SafetyExecutionRecord,
  ): void {
    this.auditLog.push({
      ...record,
    });

    if (
      this.auditLog.length >
      MAX_AUDIT_ENTRIES
    ) {
      this.auditLog.shift();
    }
  }
}