import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  EmotionEngine,
} from './emotionEngine';

import {
  SelfEvaluationEngine,
} from './selfEvaluationEngine';

import {
  SemanticCandidateService,
} from './semanticCandidateService';

import {
  SemanticFeedbackService,
} from './semanticFeedbackService';

import {
  ModeManager,
} from '../services/modeManager';

export type GoalType =
  | 'learn_topic'
  | 'investigate_user'
  | 'protect_emotional_stability'
  | 'reduce_repetition'
  | 'improve_semantic_model'
  | 'explore_new_topics'
  | 'maintain_chat_harmony';

export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';

export type GoalStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AutonomousGoal {
  id: string;
  type: GoalType;
  title: string;
  description: string;
  priority: GoalPriority;
  status: GoalStatus;
  progress: number; // 0 a 100
  targetMetric: string;
  currentValue: number;
  targetValue: number;
  criteria: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface GoalEngineOptions {
  storageFile?: string;
}

const DEFAULT_STORAGE_PATH = path.join(
  process.cwd(),
  'data',
  'goals.json',
);

const PRIORITY_ORDER: Record<GoalPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Goal Engine
 *
 * Mecanismo de governança de objetivos autônomos para o Imperador.
 * Permite criar, rastrear, avaliar e concluir objetivos estratégicos
 * orientados a aprendizado, controle emocional, consistência e harmonia.
 */
export class GoalEngine {
  private static goals: Map<string, AutonomousGoal> = new Map();
  private static storageFile: string = DEFAULT_STORAGE_PATH;
  private static isInitialized = false;

  public static initialize(storageFile?: string): void {
    if (storageFile) {
      this.storageFile = storageFile;
    }

    this.goals.clear();
    this.isInitialized = true;
    this.load();
  }

  public static createGoal(options: {
    type: GoalType;
    title: string;
    description: string;
    priority?: GoalPriority;
    targetMetric: string;
    targetValue: number;
    initialValue?: number;
    criteria: string[];
    metadata?: Record<string, unknown>;
  }): AutonomousGoal {
    this.ensureInitialized();

    const timestamp = Date.now();
    const id = `goal_${options.type}_${timestamp}_${Math.floor(Math.random() * 1000)}`;
    const priority = options.priority ?? 'medium';
    const initialValue = options.initialValue ?? 0;

    let progress = 0;
    if (options.targetValue > 0) {
      progress = Math.min(100, Math.max(0, Math.round((initialValue / options.targetValue) * 100)));
    }

    const goal: AutonomousGoal = {
      id,
      type: options.type,
      title: options.title,
      description: options.description,
      priority,
      status: 'active',
      progress,
      targetMetric: options.targetMetric,
      currentValue: initialValue,
      targetValue: options.targetValue,
      criteria: [...options.criteria],
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: options.metadata,
    };

    this.goals.set(id, goal);
    this.save();
    return { ...goal };
  }

  public static getGoal(id: string): AutonomousGoal | null {
    this.ensureInitialized();
    const goal = this.goals.get(id);
    return goal ? { ...goal } : null;
  }

  public static getAllGoals(): AutonomousGoal[] {
    this.ensureInitialized();
    return Array.from(this.goals.values()).map(g => ({ ...g }));
  }

  public static getActiveGoals(): AutonomousGoal[] {
    this.ensureInitialized();
    return Array.from(this.goals.values())
      .filter(g => g.status === 'active' || g.status === 'pending')
      .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
  }

  public static updateProgress(
    id: string,
    currentValue: number,
  ): AutonomousGoal | null {
    this.ensureInitialized();
    const goal = this.goals.get(id);
    if (!goal || goal.status === 'completed' || goal.status === 'cancelled') {
      return null;
    }

    goal.currentValue = currentValue;
    goal.updatedAt = Date.now();

    if (goal.targetValue > 0) {
      goal.progress = Math.min(
        100,
        Math.max(0, Math.round((currentValue / goal.targetValue) * 100)),
      );
    }

    if (goal.currentValue >= goal.targetValue) {
      goal.status = 'completed';
      goal.progress = 100;
      goal.completedAt = Date.now();
    }

    this.save();
    return { ...goal };
  }

  public static cancelGoal(id: string, reason?: string): boolean {
    this.ensureInitialized();
    const goal = this.goals.get(id);
    if (!goal || goal.status === 'completed' || goal.status === 'cancelled') {
      return false;
    }

    goal.status = 'cancelled';
    goal.updatedAt = Date.now();
    if (reason) {
      goal.metadata = { ...goal.metadata, cancellationReason: reason };
    }

    this.save();
    return true;
  }

  /**
   * Avalia o ecossistema interno do bot e cria objetivos autônomos
   * caso identifique oportunidades ou necessidades no ambiente.
   */
  public static evaluateEnvironmentalTriggers(): AutonomousGoal[] {
    this.ensureInitialized();
    const created: AutonomousGoal[] = [];
    const activeGoals = this.getActiveGoals();

    // 1. Objetivo de Melhorar Modelo Semântico (quando candidatos ou feedbacks acumulam)
    const pendingCandidates = SemanticCandidateService.getPendingCount();
    const hasActiveSemanticGoal = activeGoals.some(
      g => g.type === 'improve_semantic_model',
    );

    if (pendingCandidates >= 5 && !hasActiveSemanticGoal) {
      const g = this.createGoal({
        type: 'improve_semantic_model',
        title: 'Revisar Candidatos de Active Learning',
        description: 'Processar e rotular exemplos incertos para refinar o modelo semântico de sentenças.',
        priority: 'high',
        targetMetric: 'candidatos_revisados',
        targetValue: pendingCandidates,
        initialValue: 0,
        criteria: [
          'Reduzir a fila de candidatos pendentes a zero',
          'Alimentar feedback com dados validados humanamente',
        ],
      });
      created.push(g);
    }

    // 2. Objetivo de Reduzir Repetição (quando a métrica de novidade cair)
    const qualityMetrics = SelfEvaluationEngine.getAggregateMetrics();
    const hasActiveRepetitionGoal = activeGoals.some(
      g => g.type === 'reduce_repetition',
    );

    if (
      qualityMetrics.totalEvaluations >= 3 &&
      qualityMetrics.averageNovelty < 0.60 &&
      !hasActiveRepetitionGoal
    ) {
      const g = this.createGoal({
        type: 'reduce_repetition',
        title: 'Diversificar Vocabulário Imperial',
        description: 'Elevar a taxa de novidade das respostas evitando reuso de frases idênticas.',
        priority: 'medium',
        targetMetric: 'average_novelty',
        targetValue: 80, // Meta: 80% de novidade
        initialValue: Math.round(qualityMetrics.averageNovelty * 100),
        criteria: [
          'Atingir média de novidade >= 80%',
          'Utilizar variantes de respostas imperiais alternativas',
        ],
      });
      created.push(g);
    }

    // 3. Objetivo de Proteger Estabilidade Emocional (se irritação interna subir muito)
    const emotion = EmotionEngine.getState();
    const hasEmotionalGoal = activeGoals.some(
      g => g.type === 'protect_emotional_stability',
    );

    if (emotion.irritation >= 70 && !hasEmotionalGoal) {
      const g = this.createGoal({
        type: 'protect_emotional_stability',
        title: 'Restaurar Serenidade Imperial',
        description: 'Dissipar a irritação excessiva acumulada através de tempo ou descompressão.',
        priority: 'critical',
        targetMetric: 'irritation_level',
        targetValue: 40, // Meta: abaixar irritação para 40
        initialValue: emotion.irritation,
        criteria: [
          'Reduzir irritação abaixo de 40',
          'Evitar escalada de hostilidade desmedida no servidor',
        ],
      });
      created.push(g);
    }

    return created;
  }

  /**
   * Avalia e atualiza o progresso de todos os objetivos ativos
   * de acordo com as métricas em tempo real dos sistemas.
   */
  public static tick(): { updatedCount: number; completedCount: number } {
    this.ensureInitialized();
    let updatedCount = 0;
    let completedCount = 0;

    const activeGoals = this.getActiveGoals();

    for (const goal of activeGoals) {
      let currentVal = goal.currentValue;

      if (goal.type === 'improve_semantic_model') {
        const remaining = SemanticCandidateService.getPendingCount();
        const processed = Math.max(0, goal.targetValue - remaining);
        currentVal = processed;
      } else if (goal.type === 'protect_emotional_stability') {
        const irritation = EmotionEngine.getState().irritation;
        // Meta de diminuição: progresso avança conforme irritação cai
        const initial = (goal.metadata?.initialIrritation as number) ?? 70;
        const progressAmount = Math.max(0, initial - irritation);
        const neededReduction = Math.max(1, initial - goal.targetValue);
        currentVal = Math.round((progressAmount / neededReduction) * goal.targetValue);
        if (irritation <= goal.targetValue) {
          currentVal = goal.targetValue;
        }
      } else if (goal.type === 'reduce_repetition') {
        const nov = SelfEvaluationEngine.getAggregateMetrics().averageNovelty;
        currentVal = Math.round(nov * 100);
      }

      if (currentVal !== goal.currentValue) {
        const updated = this.updateProgress(goal.id, currentVal);
        if (updated) {
          updatedCount++;
          if (updated.status === 'completed') {
            completedCount++;
          }
        }
      }
    }

    return { updatedCount, completedCount };
  }

  public static reset(): void {
    this.goals.clear();
    try {
      if (fs.existsSync(this.storageFile)) {
        fs.unlinkSync(this.storageFile);
      }
    } catch {
      // Ignora erro de remoção em testes
    }
    this.isInitialized = false;
  }

  private static ensureInitialized(): void {
    if (!this.isInitialized) {
      this.initialize();
    }
  }

  private static load(): void {
    try {
      if (!fs.existsSync(this.storageFile)) {
        return;
      }

      const raw = fs.readFileSync(this.storageFile, 'utf-8');
      const data = JSON.parse(raw);

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.id && item.type) {
            this.goals.set(item.id, item);
          }
        }
      }
    } catch {
      // Arquivo inexistente ou corrompido: inicia limpo
    }
  }

  private static save(): void {
    try {
      const dir = path.dirname(this.storageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const serialized = JSON.stringify(
        Array.from(this.goals.values()),
        null,
        2,
      );

      fs.writeFileSync(this.storageFile, serialized, 'utf-8');
    } catch {
      // Ignora erros momentâneos de gravação
    }
  }
}
