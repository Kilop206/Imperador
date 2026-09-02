import {
  TiberiusMode,
} from '../types/tiberius';

import {
  SemanticFeedbackService,
} from './semanticFeedbackService';

import {
  SemanticCandidateService,
} from './semanticCandidateService';

import {
  ModeManager,
} from '../services/modeManager';

export interface LearningControllerPolicy {
  /**
   * Se a coleta de dados de aprendizado está ativa.
   */
  dataCollectionEnabled: boolean;

  /**
   * Quantidade mínima de feedbacks acumulados para permitir treinamento.
   */
  minFeedbackForTraining: number;

  /**
   * Quantidade máxima de exemplos agrupados em um lote de treinamento.
   */
  maxBatchSize: number;

  /**
   * Quantidade mínima de candidatos pendentes para disparar solicitação de revisão humana.
   */
  minCandidatesForReviewRequest: number;

  /**
   * Intervalo mínimo em milissegundos entre solicitações consecutivas de revisão humana.
   */
  reviewRequestCooldownMs: number;

  /**
   * Intervalo mínimo em milissegundos entre dois treinamentos consecutivos.
   */
  trainingCooldownMs: number;

  /**
   * Razão máxima permitida para a classe majoritária no feedback (evita viés extremo).
   * Ex: 0.85 = se >85% dos feedbacks forem positivos ou negativos, bloqueia treino.
   */
  maxClassImbalanceRatio: number;

  /**
   * Modos operacionais em que o treinamento é estritamente PROIBIDO.
   */
  forbiddenModesForTraining: readonly TiberiusMode[];

  /**
   * Se o treinamento pode ser disparado de forma totalmente autônoma
   * ao atingir as metas da política.
   */
  autoTrainingEnabled: boolean;
}

export interface TrainingMetrics {
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
  positiveRatio: number;
  negativeRatio: number;
  cooldownRemainingMs: number;
  currentMode: TiberiusMode;
}

export interface TrainingDecision {
  canTrain: boolean;
  reason: string;
  blockingReasons: string[];
  metrics: TrainingMetrics;
}

export interface ReviewRequestDecision {
  shouldRequest: boolean;
  pendingCount: number;
  reason: string;
}

export interface DataCollectionDecision {
  shouldCollect: boolean;
  reason: string;
}

export interface BatchingDecision {
  shouldBatch: boolean;
  batchSize: number;
  reason: string;
}

export const DEFAULT_LEARNING_POLICY: Readonly<LearningControllerPolicy> = {
  dataCollectionEnabled: true,
  minFeedbackForTraining: 5,
  maxBatchSize: 50,
  minCandidatesForReviewRequest: 5,
  reviewRequestCooldownMs: 30 * 60 * 1000, // 30 minutos
  trainingCooldownMs: 60 * 60 * 1000,      // 1 hora
  maxClassImbalanceRatio: 0.85,
  forbiddenModesForTraining: ['threat', 'drunk'],
  autoTrainingEnabled: false,
};

/**
 * Autonomous Learning Controller
 *
 * Controlador responsável pela governança do ciclo de aprendizado contínuo.
 * Decide de forma autônoma e determinística:
 *
 * 1. Quando coletar dados
 * 2. Quando agrupar exemplos
 * 3. Quando solicitar revisão humana
 * 4. Quando há feedback suficiente
 * 5. Quando iniciar treinamento
 * 6. Quando NÃO deve treinar (bloqueios por política e segurança)
 */
export class AutonomousLearningController {
  private static policy: LearningControllerPolicy = {
    ...DEFAULT_LEARNING_POLICY,
  };

  private static lastTrainingTimestamp = 0;
  private static lastReviewRequestTimestamp = 0;

  /**
   * Retorna uma cópia da política atualmente ativa.
   */
  public static getPolicy(): Readonly<LearningControllerPolicy> {
    return { ...this.policy };
  }

  /**
   * Atualiza a política com configurações parciais.
   */
  public static setPolicy(newPolicy: Partial<LearningControllerPolicy>): void {
    this.policy = {
      ...this.policy,
      ...newPolicy,
    };
  }

  /**
   * Restaura a política para os valores padrão.
   */
  public static resetPolicy(): void {
    this.policy = { ...DEFAULT_LEARNING_POLICY };
    this.lastTrainingTimestamp = 0;
    this.lastReviewRequestTimestamp = 0;
  }

  /**
   * 1. Decide quando coletar dados de mensagens / interações.
   */
  public static shouldCollectData(
    content: string,
    mode?: TiberiusMode,
  ): DataCollectionDecision {
    if (!this.policy.dataCollectionEnabled) {
      return {
        shouldCollect: false,
        reason: 'Coleta de dados desativada por política.',
      };
    }

    const currentMode = mode ?? ModeManager.getMode();

    if (currentMode === 'threat') {
      return {
        shouldCollect: false,
        reason: 'Coleta suspensa durante modo de ameaça/defesa.',
      };
    }

    const trimmed = content?.trim() ?? '';

    if (trimmed.length < 3) {
      return {
        shouldCollect: false,
        reason: 'Conteúdo excessivamente curto para aprendizado útil.',
      };
    }

    if (trimmed.startsWith('!')) {
      return {
        shouldCollect: false,
        reason: 'Comandos do sistema não são coletados para aprendizado.',
      };
    }

    return {
      shouldCollect: true,
      reason: 'Critérios de coleta atendidos.',
    };
  }

  /**
   * 2. Decide quando agrupar exemplos em lotes (batching).
   */
  public static shouldBatchExamples(count: number): BatchingDecision {
    if (count <= 0) {
      return {
        shouldBatch: false,
        batchSize: 0,
        reason: 'Nenhum exemplo para processar em lote.',
      };
    }

    if (count >= this.policy.maxBatchSize) {
      return {
        shouldBatch: true,
        batchSize: this.policy.maxBatchSize,
        reason: `Lote completo atingido (${this.policy.maxBatchSize} exemplos).`,
      };
    }

    return {
      shouldBatch: false,
      batchSize: count,
      reason: `Quantidade insuficiente para formar lote completo (${count}/${this.policy.maxBatchSize}).`,
    };
  }

  /**
   * 3. Decide quando solicitar revisão humana.
   */
  public static shouldRequestReview(
    currentTime: number = Date.now(),
  ): ReviewRequestDecision {
    const pendingCount = SemanticCandidateService.getPendingCount();

    if (pendingCount < this.policy.minCandidatesForReviewRequest) {
      return {
        shouldRequest: false,
        pendingCount,
        reason: `Candidatos pendentes (${pendingCount}) abaixo do limiar (${this.policy.minCandidatesForReviewRequest}).`,
      };
    }

    const timeSinceLastRequest = currentTime - this.lastReviewRequestTimestamp;

    if (timeSinceLastRequest < this.policy.reviewRequestCooldownMs) {
      const remainingCooldown = Math.ceil(
        (this.policy.reviewRequestCooldownMs - timeSinceLastRequest) / 1000,
      );

      return {
        shouldRequest: false,
        pendingCount,
        reason: `Solicitação de revisão em cooldown (${remainingCooldown}s restantes).`,
      };
    }

    return {
      shouldRequest: true,
      pendingCount,
      reason: `${pendingCount} candidatos aguardam revisão e cooldown expirou.`,
    };
  }

  /**
   * 4. Decide se já existe quantidade suficiente de feedback.
   */
  public static hasSufficientFeedback(): {
    hasSufficient: boolean;
    feedbackCount: number;
    minRequired: number;
    reason: string;
  } {
    const feedbackCount = SemanticFeedbackService.getCount();
    const minRequired = this.policy.minFeedbackForTraining;

    const hasSufficient = feedbackCount >= minRequired;

    return {
      hasSufficient,
      feedbackCount,
      minRequired,
      reason: hasSufficient
        ? `Quantidade de feedback (${feedbackCount}) atende ao mínimo (${minRequired}).`
        : `Quantidade de feedback (${feedbackCount}) abaixo do mínimo (${minRequired}).`,
    };
  }

  /**
   * 5 & 6. Avalia se deve iniciar treinamento e identifica todas as razões
   * pelas quais o sistema NÃO DEVE treinar.
   */
  public static evaluateTrainingReadiness(
    currentTime: number = Date.now(),
    mode?: TiberiusMode,
  ): TrainingDecision {
    const blockingReasons: string[] = [];
    const currentMode = mode ?? ModeManager.getMode();

    const totalFeedback = SemanticFeedbackService.getCount();
    const positiveCount = SemanticFeedbackService.getPositiveCount();
    const negativeCount = SemanticFeedbackService.getNegativeCount();

    const positiveRatio =
      totalFeedback > 0 ? positiveCount / totalFeedback : 0;
    const negativeRatio =
      totalFeedback > 0 ? negativeCount / totalFeedback : 0;

    const timeSinceLastTrain = currentTime - this.lastTrainingTimestamp;
    const cooldownRemainingMs = Math.max(
      0,
      this.policy.trainingCooldownMs - timeSinceLastTrain,
    );

    // 1. Feedback insuficiente
    if (totalFeedback < this.policy.minFeedbackForTraining) {
      blockingReasons.push(
        `Feedback insuficiente: ${totalFeedback}/${this.policy.minFeedbackForTraining} exemplos necessários.`,
      );
    }

    // 2. Cooldown de treinamento ativo
    if (this.lastTrainingTimestamp > 0 && cooldownRemainingMs > 0) {
      const remainingSeconds = Math.ceil(cooldownRemainingMs / 1000);
      blockingReasons.push(
        `Treinamento recente em cooldown (${remainingSeconds}s restantes).`,
      );
    }

    // 3. Modo proibido para treinamento
    if (this.policy.forbiddenModesForTraining.includes(currentMode)) {
      blockingReasons.push(
        `Treinamento proibido no modo operacional atual: "${currentMode}".`,
      );
    }

    // 4. Desbalanceamento extremo de classes
    if (totalFeedback >= this.policy.minFeedbackForTraining) {
      if (
        positiveRatio > this.policy.maxClassImbalanceRatio ||
        negativeRatio > this.policy.maxClassImbalanceRatio
      ) {
        blockingReasons.push(
          `Desbalanceamento extremo de classes no feedback (Positivos: ${(
            positiveRatio * 100
          ).toFixed(1)}%, Negativos: ${(negativeRatio * 100).toFixed(
            1,
          )}%). Limite máximo: ${(
            this.policy.maxClassImbalanceRatio * 100
          ).toFixed(0)}%.`,
        );
      }
    }

    const canTrain = blockingReasons.length === 0;

    const reason = canTrain
      ? 'Todas as condições de aprendizado e segurança foram satisfeitas.'
      : `Treinamento bloqueado por: ${blockingReasons.join(' | ')}`;

    return {
      canTrain,
      reason,
      blockingReasons,
      metrics: {
        totalFeedback,
        positiveCount,
        negativeCount,
        positiveRatio,
        negativeRatio,
        cooldownRemainingMs,
        currentMode,
      },
    };
  }

  /**
   * Decide se o treinamento autônomo deve ser disparado de imediato.
   */
  public static canTriggerAutoTraining(
    currentTime: number = Date.now(),
    mode?: TiberiusMode,
  ): boolean {
    if (!this.policy.autoTrainingEnabled) {
      return false;
    }

    return this.evaluateTrainingReadiness(currentTime, mode).canTrain;
  }

  /**
   * Registra a execução de um treinamento para controle de cooldown.
   */
  public static recordTrainingExecution(timestamp: number = Date.now()): void {
    this.lastTrainingTimestamp = timestamp;
  }

  /**
   * Registra a emissão de uma solicitação de revisão para controle de cooldown.
   */
  public static recordReviewRequest(timestamp: number = Date.now()): void {
    this.lastReviewRequestTimestamp = timestamp;
  }

  /**
   * Retorna o timestamp do último treinamento registrado.
   */
  public static getLastTrainingTimestamp(): number {
    return this.lastTrainingTimestamp;
  }

  /**
   * Retorna o timestamp da última solicitação de revisão registrada.
   */
  public static getLastReviewRequestTimestamp(): number {
    return this.lastReviewRequestTimestamp;
  }
}
