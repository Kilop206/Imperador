import {
  MessageIntent,
} from '../services/textAnalyzer';

import {
  IntentClassifier,
  type IntentPrediction,
} from './intentClassifier';

import {
  IntentLearningService,
} from './intentLearningService';

import {
  IntentCandidateService,
  type IntentCandidate,
} from './intentCandidateService';

import {
  IntentFeedbackService,
} from './intentFeedbackService';

import {
  ActiveLearningService,
  type ActiveLearningScore,
} from './activeLearningService';

import {
  ModelManager,
  type ModelManagerStatus,
} from './modelManager';

import {
  SemanticFeedbackTrainingService,
  type SemanticFeedbackTrainingOptions,
  type SemanticFeedbackTrainingContext,
} from './semanticFeedbackTrainingService';

import {
  SemanticSafeFineTuningService,
  type SemanticSafeFineTuningResult,
} from './semanticSafeFineTuningService';

import type {
  SemanticPromotionThresholds,
} from './semanticModelPromotionService';

export interface AIRuntimePrediction {
  prediction: IntentPrediction;
  activeLearning: ActiveLearningScore;
}

export interface AIRuntimeSemanticTrainingResult {
  safeFineTuning:
    SemanticSafeFineTuningResult;

  context:
    SemanticFeedbackTrainingContext;
}

export interface AIRuntimeStatus {
  initialized: boolean;

  intent: {
    trained: boolean;
    vocabularySize: number;
    trainingExamples: number;
    learnedExamples: number;
    totalExamples: number;
    pendingCandidates: number;
  };

  semantic: ModelManagerStatus;
}

export class AIRuntimeService {
  private static initialized = false;

  public static initialize(): void {
    if (this.initialized) {
      return;
    }

    /*
     * O aprendizado incremental de intenção
     * precisa estar carregado antes do classifier
     * ser utilizado.
     */
    IntentLearningService.initialize();

    /*
     * Inicializa os modelos semânticos,
     * carregando os modelos persistidos quando
     * disponíveis ou treinando-os quando necessário.
     */
    ModelManager.initialize();

    this.initialized = true;
  }

  public static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  public static isInitialized(): boolean {
    return this.initialized;
  }

  public static analyzeIntent(
    text: string,
  ): AIRuntimePrediction {
    this.ensureInitialized();

    const prediction =
      IntentClassifier.predict(
        text,
      );

    const activeLearning =
      ActiveLearningService.score(
        text,
        prediction,
      );

    return {
      prediction,
      activeLearning,
    };
  }

  /**
   * Analisa uma mensagem e, caso ela possua
   * valor suficiente para active learning,
   * adiciona-a à fila de candidatos.
   */
  public static collectCandidate(
    text: string,
    prediction: IntentPrediction,
    minimumScore = 0.45,
  ): IntentCandidate | null {
    this.ensureInitialized();

    const result =
      ActiveLearningService.consider(
        text,
        prediction,
        minimumScore,
      );

    if (!result.shouldCollect) {
      return null;
    }

    const normalized =
      this.normalize(text);

    const candidates =
      IntentCandidateService.getPending(
        1000,
      );

    return (
      candidates.find(
        candidate =>
          this.normalize(
            candidate.text,
          ) === normalized,
      ) ?? null
    );
  }

  /**
   * Aprova manualmente um candidato de intenção.
   *
   * O IntentFeedbackService já cuida de:
   * - armazenar o exemplo;
   * - re-treinar o IntentClassifier;
   * - marcar o candidato como revisado.
   */
  public static approveIntent(
    candidateId: number,
    intent: MessageIntent,
  ): boolean {
    this.ensureInitialized();

    return IntentFeedbackService.approve(
      candidateId,
      intent,
    );
  }

  /**
   * Rejeita um candidato de intenção sem
   * adicioná-lo ao conjunto de treinamento.
   */
  public static rejectIntent(
    candidateId: number,
  ): boolean {
    this.ensureInitialized();

    return IntentFeedbackService.reject(
      candidateId,
    );
  }

  public static getPendingIntentCandidates(
    limit = 10,
  ): IntentCandidate[] {
    this.ensureInitialized();

    return IntentCandidateService.getPending(
      limit,
    );
  }

  public static getPendingIntentCandidateCount():
    number {
    this.ensureInitialized();

    return IntentCandidateService
      .getPendingCount();
  }

  public static getIntentPrediction(
    text: string,
  ): IntentPrediction {
    this.ensureInitialized();

    return IntentClassifier.predict(
      text,
    );
  }

  public static retrainIntentModel(): void {
    this.ensureInitialized();

    IntentLearningService.retrain();
  }

  /**
   * Inicia um ciclo de fine-tuning semântico
   * controlado pelo AIRuntime.
   *
   * Fluxo:
   *
   * feedback
   *   ↓
   * split disjunto
   *   ↓
   * train + feedback
   *   ↓
   * fine-tuning
   *   ↓
   * promotion gate
   *   ↓
   * ativação OU rollback
   */
  public static trainSemanticFromFeedback(
    options: SemanticFeedbackTrainingOptions = {},
    thresholds: Partial<SemanticPromotionThresholds> = {},
  ): AIRuntimeSemanticTrainingResult {
    this.ensureInitialized();

    const preparation =
      SemanticFeedbackTrainingService
        .prepareTraining(
          options,
        );

    const safeFineTuning =
      new SemanticSafeFineTuningService();

    const result =
      safeFineTuning.run(
        preparation.input,
        thresholds,
      );

    return {
      safeFineTuning:
        result,

      context:
        preparation.context,
    };
  }

  /**
   * Retorna como o próximo treinamento semântico
   * ficará dividido, sem executar fine-tuning.
   */
  public static previewSemanticTraining(
    options: SemanticFeedbackTrainingOptions = {},
  ): SemanticFeedbackTrainingContext {
    this.ensureInitialized();

    return SemanticFeedbackTrainingService
      .preview(
        options,
      );
  }

  /**
   * Persiste explicitamente os modelos semânticos
   * atualmente ativos.
   */
  public static saveModels(): void {
    this.ensureInitialized();

    ModelManager.save();
  }

  public static getStatus():
    AIRuntimeStatus {
    this.ensureInitialized();

    return {
      initialized:
        this.initialized,

      intent: {
        trained:
          IntentClassifier.isTrained(),

        vocabularySize:
          IntentClassifier
            .getVocabularySize(),

        trainingExamples:
          IntentClassifier
            .getTrainingExampleCount(),

        learnedExamples:
          IntentLearningService
            .getLearnedExampleCount(),

        totalExamples:
          IntentLearningService
            .getTotalExampleCount(),

        pendingCandidates:
          IntentCandidateService
            .getPendingCount(),
      },

      semantic:
        ModelManager.getStatus(),
    };
  }

  public static reset(): void {
    this.initialized = false;
  }

  private static normalize(
    text: string,
  ): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        ' ',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }
}