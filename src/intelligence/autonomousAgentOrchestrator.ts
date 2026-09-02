import {
  GoalEngine,
  AutonomousGoal,
} from './goalEngine';

import {
  PlanningEngine,
  AutonomousPlan,
  PlanStep,
} from './planningEngine';

import {
  SafetyPermissionEngine,
} from './safetyPermissionEngine';

import {
  ObservationEngine,
  Observation,
} from './observationEngine';

export type OrchestratorDecision =
  | 'disabled'
  | 'idle'
  | 'goal_created'
  | 'plan_created'
  | 'executed'
  | 'blocked'
  | 'completed'
  | 'failed';

export interface AutonomousAgentOrchestratorOptions {
  enabled?: boolean;
  minimumCycleIntervalMs?: number;
  maximumCyclesPerWindow?: number;
  cycleWindowMs?: number;
}

export interface AutonomousAgentOrchestratorStatus {
  enabled: boolean;
  running: boolean;
  lastCycleTimestamp: number;
  cycleCount: number;
  blockedCount: number;
  failedCount: number;
  completedPlanCount: number;
  activeGoalCount: number;
  activePlanCount: number;
  lastDecision: OrchestratorDecision;
  lastError: string | null;
}

export interface AutonomousAgentCycleResult {
  decision: OrchestratorDecision;
  timestamp: number;
  goalId?: string;
  planId?: string;
  stepId?: string;
  observationId?: string;
  reason: string;
}

const DEFAULT_MINIMUM_CYCLE_INTERVAL_MS =
  5_000;

const DEFAULT_MAXIMUM_CYCLES_PER_WINDOW =
  30;

const DEFAULT_CYCLE_WINDOW_MS =
  60 * 60 * 1000;

export class AutonomousAgentOrchestrator {
  private readonly safety:
    SafetyPermissionEngine;

  private readonly observations:
    ObservationEngine;

  private readonly minimumCycleIntervalMs:
    number;

  private readonly maximumCyclesPerWindow:
    number;

  private readonly cycleWindowMs:
    number;

  private enabled = true;

  private running = false;

  private lastCycleTimestamp = 0;

  private cycleTimestamps: number[] = [];

  private blockedCount = 0;

  private failedCount = 0;

  private completedPlanCount = 0;

  private lastDecision:
    OrchestratorDecision =
      'idle';

  private lastError:
    string | null = null;

  public constructor(
    safety:
      SafetyPermissionEngine,
    observations:
      ObservationEngine,
    options:
      AutonomousAgentOrchestratorOptions = {},
  ) {
    if (!safety) {
      throw new TypeError(
        'SafetyPermissionEngine é obrigatório.',
      );
    }

    if (!observations) {
      throw new TypeError(
        'ObservationEngine é obrigatório.',
      );
    }

    const minimumCycleIntervalMs =
      options.minimumCycleIntervalMs ??
      DEFAULT_MINIMUM_CYCLE_INTERVAL_MS;

    const maximumCyclesPerWindow =
      options.maximumCyclesPerWindow ??
      DEFAULT_MAXIMUM_CYCLES_PER_WINDOW;

    const cycleWindowMs =
      options.cycleWindowMs ??
      DEFAULT_CYCLE_WINDOW_MS;

    if (
      !Number.isFinite(
        minimumCycleIntervalMs,
      ) ||
      minimumCycleIntervalMs < 0
    ) {
      throw new RangeError(
        'minimumCycleIntervalMs deve ser um número maior ou igual a zero.',
      );
    }

    if (
      !Number.isFinite(
        maximumCyclesPerWindow,
      ) ||
      maximumCyclesPerWindow <= 0
    ) {
      throw new RangeError(
        'maximumCyclesPerWindow deve ser maior que zero.',
      );
    }

    if (
      !Number.isFinite(
        cycleWindowMs,
      ) ||
      cycleWindowMs <= 0
    ) {
      throw new RangeError(
        'cycleWindowMs deve ser maior que zero.',
      );
    }

    this.safety =
      safety;

    this.observations =
      observations;

    this.minimumCycleIntervalMs =
      Math.floor(
        minimumCycleIntervalMs,
      );

    this.maximumCyclesPerWindow =
      Math.floor(
        maximumCyclesPerWindow,
      );

    this.cycleWindowMs =
      Math.floor(
        cycleWindowMs,
      );

    this.enabled =
      options.enabled ?? true;
  }

  public async tick(
    currentTime = Date.now(),
  ): Promise<AutonomousAgentCycleResult> {
    if (!this.enabled) {
      this.lastDecision =
        'disabled';

      return {
        decision:
          'disabled',
        timestamp:
          currentTime,
        reason:
          'Orquestrador autônomo desabilitado.',
      };
    }

    if (this.running) {
      return {
        decision:
          'idle',
        timestamp:
          currentTime,
        reason:
          'Um ciclo autônomo já está em execução.',
      };
    }

    if (
      !this.canStartCycle(
        currentTime,
      )
    ) {
      return {
        decision:
          'idle',
        timestamp:
          currentTime,
        reason:
          'Ciclo bloqueado por intervalo mínimo ou limite de frequência.',
      };
    }

    this.running = true;

    this.lastCycleTimestamp =
      currentTime;

    this.recordCycle(
      currentTime,
    );

    try {
      return await this.executeCycle(
        currentTime,
      );
    } finally {
      this.running =
        false;
    }
  }

  public setEnabled(
    enabled: boolean,
  ): void {
    this.enabled =
      enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getStatus():
    AutonomousAgentOrchestratorStatus {
    const activeGoals =
      GoalEngine.getActiveGoals();

    const activePlans =
      PlanningEngine.getAllPlans()
        .filter(
          plan =>
            plan.status ===
              'ready' ||
            plan.status ===
              'executing',
        );

    return {
      enabled:
        this.enabled,
      running:
        this.running,
      lastCycleTimestamp:
        this.lastCycleTimestamp,
      cycleCount:
        this.cycleTimestamps.length,
      blockedCount:
        this.blockedCount,
      failedCount:
        this.failedCount,
      completedPlanCount:
        this.completedPlanCount,
      activeGoalCount:
        activeGoals.length,
      activePlanCount:
        activePlans.length,
      lastDecision:
        this.lastDecision,
      lastError:
        this.lastError,
    };
  }

  public resetRuntimeState(): void {
    this.running =
      false;

    this.lastCycleTimestamp =
      0;

    this.cycleTimestamps = [];

    this.blockedCount =
      0;

    this.failedCount =
      0;

    this.completedPlanCount =
      0;

    this.lastDecision =
      'idle';

    this.lastError =
      null;
  }

  private async executeCycle(
    currentTime: number,
  ): Promise<AutonomousAgentCycleResult> {
    this.lastError =
      null;

    GoalEngine.tick();

    const createdGoals =
      GoalEngine.evaluateEnvironmentalTriggers();

    if (
      createdGoals.length > 0
    ) {
      const goal =
        this.selectHighestPriorityGoal(
          createdGoals,
        );

      this.lastDecision =
        'goal_created';

      return {
        decision:
          'goal_created',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        reason:
          `Novo objetivo autônomo criado: "${goal.title}".`,
      };
    }

    const activeGoals =
      GoalEngine.getActiveGoals();

    if (
      activeGoals.length === 0
    ) {
      this.lastDecision =
        'idle';

      return {
        decision:
          'idle',
        timestamp:
          currentTime,
        reason:
          'Nenhum objetivo autônomo ativo necessita de ação.',
      };
    }

    const goal =
      this.selectHighestPriorityGoal(
        activeGoals,
      );

    let plan =
      PlanningEngine.getPlanByGoalId(
        goal.id,
      );

    if (!plan) {
      plan =
        PlanningEngine.createPlanForGoal(
          goal,
        );

      this.lastDecision =
        'plan_created';

      return {
        decision:
          'plan_created',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        reason:
          `Plano criado para o objetivo "${goal.title}".`,
      };
    }

    if (
      plan.status ===
      'completed'
    ) {
      this.completedPlanCount +=
        1;

      this.lastDecision =
        'completed';

      return {
        decision:
          'completed',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        reason:
          `Plano "${plan.title}" já foi concluído.`,
      };
    }

    if (
      plan.status ===
        'failed' ||
      plan.status ===
        'rolled_back'
    ) {
      this.failedCount +=
        1;

      this.lastDecision =
        'failed';

      return {
        decision:
          'failed',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        reason:
          `Plano "${plan.title}" encontra-se em estado "${plan.status}".`,
      };
    }

    const nextStep =
      PlanningEngine.getNextExecutableStep(
        plan,
      );

    if (!nextStep) {
      this.lastDecision =
        'idle';

      return {
        decision:
          'idle',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        reason:
          'Nenhuma etapa está atualmente elegível para execução.',
      };
    }

    if (
      this.isToolAction(
        nextStep,
      )
    ) {
      return await this.executeToolStep(
        goal,
        plan,
        nextStep,
        currentTime,
      );
    }

    return await this.executeInternalStep(
      goal,
      plan,
      nextStep,
      currentTime,
    );
  }

  private async executeToolStep(
    goal: AutonomousGoal,
    plan: AutonomousPlan,
    step: PlanStep,
    currentTime: number,
  ): Promise<AutonomousAgentCycleResult> {
    const toolName =
      step.actionType.slice(
        'tool:'.length,
      );

    if (!toolName) {
      this.blockedCount +=
        1;

      this.lastDecision =
        'blocked';

      return {
        decision:
          'blocked',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        stepId:
          step.id,
        reason:
          'Etapa identificada como ferramenta, mas sem nome de ferramenta.',
      };
    }

    type ToolExecutionResult =
      Awaited<
        ReturnType<
          SafetyPermissionEngine['execute']
        >
      >;

    let executionResult:
      ToolExecutionResult |
      undefined;

    const toolExecutor =
      async (): Promise<
        ToolExecutionResult
      > => {
        const result =
          await this.safety.execute(
            toolName,
            step.params,
            {
              requestedAt:
                currentTime,
              source:
                'autonomous-agent',
              metadata: {
                goalId:
                  goal.id,
                planId:
                  plan.id,
                stepId:
                  step.id,
                actionType:
                  step.actionType,
              },
            },
          );

        executionResult =
          result;

        if (
          !result.success
        ) {
          throw new Error(
            result.error ??
              `Execução da ferramenta "${toolName}" foi bloqueada.`,
          );
        }

        return result;
      };

    let success =
      false;

    try {
      success =
        await PlanningEngine.executeStep(
          plan.id,
          step.id,
          toolExecutor,
        );
    } catch (error) {
      this.failedCount +=
        1;

      this.lastError =
        error instanceof Error
          ? error.message
          : String(error);

      this.lastDecision =
        'failed';

      const observation =
        this.observations.observeSystem(
          {
            summary:
              `Falha estrutural ao executar ferramenta "${toolName}".`,
            significance:
              'high',
            anomalies: [
              this.lastError,
            ],
            data: {
              goalId:
                goal.id,
              planId:
                plan.id,
              stepId:
                step.id,
              actionType:
                step.actionType,
            },
          },
        );

      return {
        decision:
          'failed',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        stepId:
          step.id,
        observationId:
          observation.id,
        reason:
          this.lastError,
      };
    }

    const execution =
      executionResult;

    let executionObservation:
      Observation |
      null =
      null;

    if (
      execution !==
        undefined
    ) {
      executionObservation =
        this.observations.observeExecution(
          execution,
          {
            data: {
              goalId:
                goal.id,
              planId:
                plan.id,
              stepId:
                step.id,
            },
          },
        );
    }

    const updatedPlan =
      PlanningEngine.getPlan(
        plan.id,
      );

    const updatedStep =
      updatedPlan?.steps.find(
        candidate =>
          candidate.id ===
          step.id,
      );

    if (
      !success &&
      execution !==
        undefined &&
      !execution.success
    ) {
      this.blockedCount +=
        1;

      this.lastDecision =
        'blocked';

      return {
        decision:
          'blocked',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        stepId:
          step.id,
        observationId:
          executionObservation?.id,
        reason:
          execution.error ??
          'Execução da ferramenta foi bloqueada.',
      };
    }

    if (
      !success
    ) {
      this.failedCount +=
        1;

      this.lastDecision =
        'failed';

      return {
        decision:
          'failed',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        stepId:
          step.id,
        observationId:
          executionObservation?.id,
        reason:
          updatedStep?.error ??
          'A ferramenta não foi concluída pelo PlanningEngine.',
      };
    }

    if (
      updatedPlan?.status ===
      'completed'
    ) {
      this.completedPlanCount +=
        1;

      this.lastDecision =
        'completed';

      return {
        decision:
          'completed',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        stepId:
          step.id,
        observationId:
          executionObservation?.id,
        reason:
          `Plano "${updatedPlan.title}" concluído após execução da ferramenta "${toolName}".`,
      };
    }

    this.lastDecision =
      'executed';

    return {
      decision:
        'executed',
      timestamp:
        currentTime,
      goalId:
        goal.id,
      planId:
        plan.id,
      stepId:
        step.id,
      observationId:
        executionObservation?.id,
      reason:
        `Ferramenta "${toolName}" executada com sucesso.`,
    };
  }

  private async executeInternalStep(
    goal: AutonomousGoal,
    plan: AutonomousPlan,
    step: PlanStep,
    currentTime: number,
  ): Promise<AutonomousAgentCycleResult> {
    let success =
      false;

    try {
      success =
        await PlanningEngine.executeStep(
          plan.id,
          step.id,
        );
    } catch (error) {
      this.failedCount +=
        1;

      this.lastError =
        error instanceof Error
          ? error.message
          : String(error);

      this.lastDecision =
        'failed';

      const observation =
        this.observations.observeSystem(
          {
            summary:
              `Falha ao executar etapa interna "${step.name}".`,
            significance:
              'high',
            anomalies: [
              this.lastError,
            ],
            data: {
              goalId:
                goal.id,
              planId:
                plan.id,
              stepId:
                step.id,
              actionType:
                step.actionType,
            },
          },
        );

      return {
        decision:
          'failed',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        stepId:
          step.id,
        observationId:
          observation.id,
        reason:
          this.lastError,
      };
    }

    const updatedPlan =
      PlanningEngine.getPlan(
        plan.id,
      );

    const updatedStep =
      updatedPlan?.steps.find(
        candidate =>
          candidate.id ===
          step.id,
      );

    const observation =
      success
        ? this.observations.observeSystem(
            {
              summary:
                `Etapa interna "${step.name}" executada.`,
              significance:
                updatedPlan?.status ===
                'completed'
                  ? 'medium'
                  : 'low',
              data: {
                goalId:
                  goal.id,
                planId:
                  plan.id,
                stepId:
                  step.id,
                actionType:
                  step.actionType,
                status:
                  updatedStep?.status ??
                  'unknown',
              },
            },
          )
        : this.observations.observeSystem(
            {
              summary:
                `Etapa interna "${step.name}" falhou.`,
              significance:
                'high',
              anomalies: [
                updatedStep?.error ??
                  'Executor retornou false.',
              ],
              data: {
                goalId:
                  goal.id,
                planId:
                  plan.id,
                stepId:
                  step.id,
                actionType:
                  step.actionType,
              },
            },
          );

    if (!success) {
      this.failedCount +=
        1;

      this.lastDecision =
        'failed';

      return {
        decision:
          'failed',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        stepId:
          step.id,
        observationId:
          observation.id,
        reason:
          updatedStep?.error ??
          'A etapa interna não foi concluída.',
      };
    }

    if (
      updatedPlan?.status ===
      'completed'
    ) {
      this.completedPlanCount +=
        1;

      this.lastDecision =
        'completed';

      return {
        decision:
          'completed',
        timestamp:
          currentTime,
        goalId:
          goal.id,
        planId:
          plan.id,
        stepId:
          step.id,
        observationId:
          observation.id,
        reason:
          `Plano "${updatedPlan.title}" concluído.`,
      };
    }

    this.lastDecision =
      'executed';

    return {
      decision:
        'executed',
      timestamp:
        currentTime,
      goalId:
        goal.id,
      planId:
        plan.id,
      stepId:
        step.id,
      observationId:
        observation.id,
      reason:
        `Etapa "${step.name}" executada.`,
    };
  }

  private isToolAction(
    step: PlanStep,
  ): boolean {
    return step.actionType.startsWith(
      'tool:',
    );
  }

  private selectHighestPriorityGoal(
    goals: AutonomousGoal[],
  ): AutonomousGoal {
    const priorityWeight: Record<
      AutonomousGoal['priority'],
      number
    > = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...goals].sort(
      (left, right) =>
        priorityWeight[
          right.priority
        ] -
          priorityWeight[
            left.priority
          ] ||
        right.updatedAt -
          left.updatedAt,
    )[0];
  }

  private canStartCycle(
    currentTime: number,
  ): boolean {
    if (
      this.lastCycleTimestamp > 0 &&
      currentTime -
        this.lastCycleTimestamp <
        this.minimumCycleIntervalMs
    ) {
      return false;
    }

    this.pruneCycleHistory(
      currentTime,
    );

    return (
      this.cycleTimestamps.length <
      this.maximumCyclesPerWindow
    );
  }

  private recordCycle(
    currentTime: number,
  ): void {
    this.cycleTimestamps.push(
      currentTime,
    );

    this.pruneCycleHistory(
      currentTime,
    );
  }

  private pruneCycleHistory(
    currentTime: number,
  ): void {
    const minimumTimestamp =
      currentTime -
      this.cycleWindowMs;

    this.cycleTimestamps =
      this.cycleTimestamps.filter(
        timestamp =>
          timestamp >=
          minimumTimestamp,
      );
  }
}