import {
  AutonomousGoal,
  GoalEngine,
  GoalType,
} from './goalEngine';

import {
  AutonomousLearningController,
} from './autonomousLearningController';

import {
  EmotionEngine,
} from './emotionEngine';

import {
  ModeManager,
} from '../services/modeManager';

import {
  AutonomousMemoryConsolidationService,
} from '../services/autonomousMemoryConsolidationService';

import {
  SelfEvaluationEngine,
} from './selfEvaluationEngine';

export type StepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export type PlanStatus =
  | 'draft'
  | 'ready'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export interface PlanStep {
  id: string;
  name: string;
  description: string;
  actionType: string;
  dependencies: string[];
  status: StepStatus;
  params: Record<string, unknown>;
  fallbackStep?: PlanStep;
  rollbackAction?: string;
  result?: unknown;
  error?: string;
}

export interface AutonomousPlan {
  id: string;
  goalId: string;
  goalType: GoalType;
  title: string;
  steps: PlanStep[];
  status: PlanStatus;
  currentStepIndex: number;
  replanCount: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  executionLog: string[];
}

export type StepExecutor = (
  step: PlanStep,
  plan: AutonomousPlan,
) => Promise<unknown> | unknown;

/**
 * Planning Engine
 *
 * Motor autônomo de planejamento do Imperador:
 * - Decompõe objetivos em etapas acionáveis
 * - Mapeia dependências estritas entre passos
 * - Suporta planos alternativos e fallbacks
 * - Executa rollback seguro se um plano falhar
 * - Replaneja dinamicamente quando o ambiente ou execução exigir
 */
export class PlanningEngine {
  private static plans: Map<string, AutonomousPlan> = new Map();
  private static defaultExecutors: Map<string, StepExecutor> = new Map();

  static {
    this.registerDefaultExecutors();
  }

  /**
   * Decompõe um objetivo em um plano estruturado de etapas com dependências e fallbacks.
   */
  public static createPlanForGoal(goal: AutonomousGoal): AutonomousPlan {
    const timestamp = Date.now();
    const id = `plan_${goal.id}_${timestamp}`;

    const steps = this.decomposeGoalIntoSteps(goal);

    const plan: AutonomousPlan = {
      id,
      goalId: goal.id,
      goalType: goal.type,
      title: `Plano: ${goal.title}`,
      steps,
      status: 'ready',
      currentStepIndex: 0,
      replanCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      executionLog: [
        `Plano criado com ${steps.length} etapas para o objetivo "${goal.title}".`,
      ],
    };

    this.plans.set(id, plan);
    return { ...plan };
  }

  public static getPlan(id: string): AutonomousPlan | null {
    const plan = this.plans.get(id);
    return plan ? { ...plan } : null;
  }

  public static getPlanByGoalId(goalId: string): AutonomousPlan | null {
    for (const plan of this.plans.values()) {
      if (plan.goalId === goalId) {
        return { ...plan };
      }
    }
    return null;
  }

  public static getAllPlans(): AutonomousPlan[] {
    return Array.from(this.plans.values()).map(p => ({ ...p }));
  }

  /**
   * Avalia se um passo está apto para execução (todas as dependências satisfeitas).
   */
  public static canExecuteStep(
    plan: AutonomousPlan,
    step: PlanStep,
  ): boolean {
    if (step.status !== 'pending') {
      return false;
    }

    if (step.dependencies.length === 0) {
      return true;
    }

    const stepMap = new Map(plan.steps.map(s => [s.id, s]));

    for (const depId of step.dependencies) {
      const dep = stepMap.get(depId);
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Retorna o próximo passo elegível para execução.
   */
  public static getNextExecutableStep(
    plan: AutonomousPlan,
  ): PlanStep | null {
    for (const step of plan.steps) {
      if (this.canExecuteStep(plan, step)) {
        return step;
      }
    }
    return null;
  }

  /**
   * Executa um passo específico do plano.
   */
  public static async executeStep(
    planId: string,
    stepId: string,
    customExecutor?: StepExecutor,
  ): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plano "${planId}" não encontrado.`);
    }

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Passo "${stepId}" não encontrado no plano "${planId}".`);
    }

    if (!this.canExecuteStep(plan, step)) {
      plan.executionLog.push(
        `Passo "${step.name}" (${step.id}) não pode ser executado: dependências pendentes.`,
      );
      return false;
    }

    plan.status = 'executing';
    step.status = 'in_progress';
    plan.updatedAt = Date.now();

    try {
      const executor =
        customExecutor ??
        this.defaultExecutors.get(step.actionType) ??
        this.fallbackNoopExecutor;

      const result = await executor(step, plan);
      step.status = 'completed';
      step.result = result;
      plan.executionLog.push(`Passo "${step.name}" concluído com sucesso.`);

      // Verifica se todos os passos foram concluídos
      const allCompleted = plan.steps.every(
        s => s.status === 'completed' || s.status === 'skipped',
      );

      if (allCompleted) {
        plan.status = 'completed';
        plan.completedAt = Date.now();
        plan.executionLog.push('Todas as etapas do plano foram concluídas com sucesso.');

        // Sincroniza meta associada se GoalEngine estiver ativo
        GoalEngine.updateProgress(plan.goalId, 100);
      }

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      step.error = errorMsg;
      plan.executionLog.push(
        `Falha na execução do passo "${step.name}": ${errorMsg}`,
      );

      // Tenta fallback alternativo se existir
      if (step.fallbackStep) {
        plan.executionLog.push(
          `Acionando plano alternativo/fallback para o passo "${step.name}".`,
        );

        const fallback = step.fallbackStep;
        step.status = 'skipped';

        try {
          const fallbackExecutor =
            this.defaultExecutors.get(fallback.actionType) ??
            this.fallbackNoopExecutor;

          const fbResult = await fallbackExecutor(fallback, plan);
          fallback.status = 'completed';
          fallback.result = fbResult;
          plan.executionLog.push(
            `Passo alternativo "${fallback.name}" executado com sucesso.`,
          );
          return true;
        } catch (fbError) {
          fallback.status = 'failed';
          fallback.error =
            fbError instanceof Error ? fbError.message : String(fbError);
          plan.executionLog.push(
            `Passo alternativo "${fallback.name}" também falhou.`,
          );
        }
      }

      step.status = 'failed';
      plan.status = 'failed';
      return false;
    }
  }

  /**
   * Executa sequencialmente o próximo passo elegível do plano.
   */
  public static async executeNext(
    planId: string,
    customExecutor?: StepExecutor,
  ): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    const nextStep = this.getNextExecutableStep(plan);
    if (!nextStep) {
      return false;
    }

    return this.executeStep(planId, nextStep.id, customExecutor);
  }

  /**
   * Replanejamento dinâmico: reformula as etapas restantes diante de imprevistos ou falhas.
   */
  public static replan(
    planId: string,
    reason: string,
  ): AutonomousPlan | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    plan.replanCount++;
    plan.updatedAt = Date.now();
    plan.executionLog.push(`Replanejamento dinâmico disparado (#${plan.replanCount}): ${reason}`);

    // Preserva passos já concluídos e regenera os passos pendentes/falhados
    const completedSteps = plan.steps.filter(s => s.status === 'completed');

    const recoveryStep: PlanStep = {
      id: `step_recovery_${plan.replanCount}_${Date.now()}`,
      name: 'Avaliar e Estabilizar Estado Após Falha',
      description: `Reavaliação adaptativa: ${reason}`,
      actionType: 'evaluate_system_health',
      dependencies: completedSteps.map(s => s.id),
      status: 'pending',
      params: { reason },
    };

    const resumedStep: PlanStep = {
      id: `step_resumed_${plan.replanCount}_${Date.now()}`,
      name: 'Retomar Ação com Parâmetros Conservadores',
      description: 'Execução compensatória de segurança.',
      actionType: 'noop',
      dependencies: [recoveryStep.id],
      status: 'pending',
      params: { conservative: true },
    };

    plan.steps = [...completedSteps, recoveryStep, resumedStep];
    plan.status = 'ready';

    return { ...plan };
  }

  /**
   * Rollback: reverte de forma compensatória todas as etapas já concluídas que possuam rollbackAction.
   */
  public static rollback(planId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    plan.executionLog.push('Iniciando rollback compensatório do plano...');

    // Percorre passos concluídos em ordem reversa
    const completedSteps = plan.steps
      .filter(s => s.status === 'completed')
      .reverse();

    for (const step of completedSteps) {
      if (step.rollbackAction) {
        try {
          const rollbackExecutor =
            this.defaultExecutors.get(step.rollbackAction) ??
            this.fallbackNoopExecutor;

          rollbackExecutor(step, plan);
          plan.executionLog.push(
            `Rollback executado com sucesso para o passo "${step.name}" (${step.rollbackAction}).`,
          );
        } catch (error) {
          plan.executionLog.push(
            `Falha no rollback do passo "${step.name}": ${String(error)}`,
          );
        }
      }
    }

    plan.status = 'rolled_back';
    plan.updatedAt = Date.now();
    return true;
  }

  /**
   * Registra um executor padrão para um tipo de ação.
   */
  public static registerExecutor(
    actionType: string,
    executor: StepExecutor,
  ): void {
    this.defaultExecutors.set(actionType, executor);
  }

  public static reset(): void {
    this.plans.clear();
  }

  /**
   * Registra executores embutidos para ações fundamentais do Imperador.
   */
  private static registerDefaultExecutors(): void {
    this.defaultExecutors.set('check_training_readiness', () => {
      const decision = AutonomousLearningController.evaluateTrainingReadiness();
      if (!decision.canTrain) {
        throw new Error(decision.reason);
      }
      return decision;
    });

    this.defaultExecutors.set('consolidate_memory', () => {
      return AutonomousMemoryConsolidationService.consolidate();
    });

    this.defaultExecutors.set('decay_emotions', () => {
      EmotionEngine.decayTicks(3);
      return EmotionEngine.getState();
    });

    this.defaultExecutors.set('reset_operational_mode', () => {
      ModeManager.resetToNormal();
      return ModeManager.getMode();
    });

    this.defaultExecutors.set('evaluate_system_health', () => {
      return {
        mode: ModeManager.getMode(),
        quality: SelfEvaluationEngine.getAggregateMetrics(),
      };
    });

    this.defaultExecutors.set('noop', () => ({ ok: true }));
  }

  private static fallbackNoopExecutor: StepExecutor = () => ({ ok: true });

  /**
   * Decompõe objetivos específicos em fluxos estruturados de passos com dependências.
   */
  private static decomposeGoalIntoSteps(goal: AutonomousGoal): PlanStep[] {
    switch (goal.type) {
      case 'improve_semantic_model': {
        const step1: PlanStep = {
          id: 'step_sem_1',
          name: 'Verificar Prontidão de Treinamento e Segurança',
          description: 'Validar se há feedback suficiente, cooldown respeitado e ausência de modos proibidos.',
          actionType: 'check_training_readiness',
          dependencies: [],
          status: 'pending',
          params: {},
          fallbackStep: {
            id: 'step_sem_fallback',
            name: 'Solicitar Revisão Humana de Candidatos',
            description: 'Notificar administradores para rotular exemplos adicionais.',
            actionType: 'noop',
            dependencies: [],
            status: 'pending',
            params: { notify: true },
          },
          rollbackAction: 'noop',
        };

        const step2: PlanStep = {
          id: 'step_sem_2',
          name: 'Consolidar Memória Semântica Pré-Treino',
          description: 'Eliminar duplicatas e associar tópicos antes do ciclo de fine-tuning.',
          actionType: 'consolidate_memory',
          dependencies: [step1.id],
          status: 'pending',
          params: {},
          rollbackAction: 'noop',
        };

        const step3: PlanStep = {
          id: 'step_sem_3',
          name: 'Finalizar Atualização e Auditoria',
          description: 'Registrar conclusão e atualizar métricas no GoalEngine.',
          actionType: 'noop',
          dependencies: [step2.id],
          status: 'pending',
          params: {},
        };

        return [step1, step2, step3];
      }

      case 'protect_emotional_stability': {
        const step1: PlanStep = {
          id: 'step_emo_1',
          name: 'Restaurar Modo Operacional Normal',
          description: 'Desativar modos voláteis (ex: drunk, threat) para restabelecer compostura.',
          actionType: 'reset_operational_mode',
          dependencies: [],
          status: 'pending',
          params: {},
          rollbackAction: 'noop',
        };

        const step2: PlanStep = {
          id: 'step_emo_2',
          name: 'Aplicar Decaimento Emocional Acelerado',
          description: 'Reduzir irritação e hostilidade em direção aos níveis de baseline.',
          actionType: 'decay_emotions',
          dependencies: [step1.id],
          status: 'pending',
          params: {},
          rollbackAction: 'noop',
        };

        return [step1, step2];
      }

      case 'reduce_repetition': {
        const step1: PlanStep = {
          id: 'step_rep_1',
          name: 'Avaliar Diagnóstico de Autoavaliação',
          description: 'Inspecionar métricas agregadas do SelfEvaluationEngine.',
          actionType: 'evaluate_system_health',
          dependencies: [],
          status: 'pending',
          params: {},
        };

        const step2: PlanStep = {
          id: 'step_rep_2',
          name: 'Diversificar Vocabulário Imperial',
          description: 'Ativar filtros conservadores de novidade no pipeline de resposta.',
          actionType: 'noop',
          dependencies: [step1.id],
          status: 'pending',
          params: { enforceNovelty: true },
        };

        return [step1, step2];
      }

      default: {
        const step1: PlanStep = {
          id: 'step_gen_1',
          name: `Análise Inicial para ${goal.title}`,
          description: goal.description,
          actionType: 'evaluate_system_health',
          dependencies: [],
          status: 'pending',
          params: {},
        };

        const step2: PlanStep = {
          id: 'step_gen_2',
          name: `Execução Principal para ${goal.title}`,
          description: 'Cumprimento dos critérios de sucesso.',
          actionType: 'noop',
          dependencies: [step1.id],
          status: 'pending',
          params: { criteria: goal.criteria },
        };

        return [step1, step2];
      }
    }
  }
}
