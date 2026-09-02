import {
  ModelManager,
} from './modelManager';

import {
  SemanticFeedbackService,
} from './semanticFeedbackService';

import {
  SEMANTIC_SENTENCE_DATASET,
} from './semanticSentenceDataset';

import {
  splitSemanticDataset,
  type SemanticDatasetSplit,
} from './semanticDatasetSplit';

import type {
  SemanticFineTuningResult,
} from './semanticFineTuningService';

export interface SemanticFeedbackTrainingOptions {
  /**
   * Seed usada para gerar sempre a mesma divisão
   * do dataset-base.
   */
  seed?: number;

  /**
   * Quantidade mínima de feedbacks necessária
   * para iniciar um treinamento.
   *
   * Padrão: 1.
   */
  minimumFeedbackExamples?: number;

  /**
   * Proporção do dataset-base usada no treino
   * apenas para fins de referência/documentação.
   *
   * O treino efetivo é controlado pelo ModelManager,
   * que mantém o dataset-base completo + feedback.
   */
  trainRatio?: number;

  validationRatio?: number;
}

export interface SemanticFeedbackTrainingContext {
  feedbackCount: number;
  trainingBaseCount: number;
  validationCount: number;
  testCount: number;
  split: SemanticDatasetSplit;
}

export interface SemanticFeedbackTrainingResult {
  result: SemanticFineTuningResult;
  context: SemanticFeedbackTrainingContext;
}

const DEFAULT_OPTIONS:
  Required<SemanticFeedbackTrainingOptions> = {
    seed: 42,
    minimumFeedbackExamples: 1,
    trainRatio: 0.70,
    validationRatio: 0.15,
  };

export class SemanticFeedbackTrainingService {
  /**
   * Executa um treinamento supervisionado usando
   * os feedbacks semânticos acumulados.
   *
   * O dataset-base é usado como núcleo do treinamento
   * e seus próprios dados são divididos para validation/test.
   *
   * Os feedbacks permanecem exclusivamente no conjunto
   * de treinamento fornecido pelo ModelManager.
   */
  static train(
    options: SemanticFeedbackTrainingOptions = {},
  ): SemanticFeedbackTrainingResult {
    const resolved =
      this.resolveOptions(
        options,
      );

    const feedback =
      SemanticFeedbackService
        .getTrainingPairs();

    if (
      feedback.length <
      resolved.minimumFeedbackExamples
    ) {
      throw new Error(
        `São necessários pelo menos ${resolved.minimumFeedbackExamples} exemplos de feedback semântico para iniciar o treinamento. Atualmente existem ${feedback.length}.`,
      );
    }

    const split =
      splitSemanticDataset(
        SEMANTIC_SENTENCE_DATASET,
        {
          trainRatio:
            resolved.trainRatio,

          validationRatio:
            resolved.validationRatio,

          seed:
            resolved.seed,
        },
      );

    /*
     * ModelManager.fineTuneFromFeedback()
     * mantém o dataset-base completo + feedback
     * no treinamento, mas recebe explicitamente
     * os conjuntos de validação e teste.
     *
     * Assim os dados utilizados como validation/test
     * não são os próprios feedbacks supervisionados.
     */
    const result =
      ModelManager
        .fineTuneFromFeedback(
          split.validation,
          split.test,
        );

    return {
      result,
      context: {
        feedbackCount:
          feedback.length,

        trainingBaseCount:
          SEMANTIC_SENTENCE_DATASET.length,

        validationCount:
          split.validation.length,

        testCount:
          split.test.length,

        split,
      },
    };
  }

  /**
   * Retorna informações sobre como o próximo treinamento
   * será estruturado, sem iniciar o treinamento.
   */
  static preview(
    options: SemanticFeedbackTrainingOptions = {},
  ): SemanticFeedbackTrainingContext {
    const resolved =
      this.resolveOptions(
        options,
      );

    const feedback =
      SemanticFeedbackService
        .getTrainingPairs();

    if (
      feedback.length <
      resolved.minimumFeedbackExamples
    ) {
      throw new Error(
        `São necessários pelo menos ${resolved.minimumFeedbackExamples} exemplos de feedback semântico para iniciar o treinamento. Atualmente existem ${feedback.length}.`,
      );
    }

    const split =
      splitSemanticDataset(
        SEMANTIC_SENTENCE_DATASET,
        {
          trainRatio:
            resolved.trainRatio,

          validationRatio:
            resolved.validationRatio,

          seed:
            resolved.seed,
        },
      );

    return {
      feedbackCount:
        feedback.length,

      trainingBaseCount:
        SEMANTIC_SENTENCE_DATASET.length,

      validationCount:
        split.validation.length,

      testCount:
        split.test.length,

      split,
    };
  }

  /**
   * Retorna quantos feedbacks supervisionados existem.
   */
  static getFeedbackCount(): number {
    return SemanticFeedbackService
      .getCount();
  }

  /**
   * Indica se já existe quantidade suficiente
   * de feedback para iniciar treinamento.
   */
  static canTrain(
    minimumFeedbackExamples = 1,
  ): boolean {
    if (
      !Number.isFinite(
        minimumFeedbackExamples,
      )
    ) {
      return false;
    }

    const minimum =
      Math.max(
        1,
        Math.floor(
          minimumFeedbackExamples,
        ),
      );

    return (
      SemanticFeedbackService
        .getCount() >= minimum
    );
  }

  /**
   * Retorna o último modelo ativo conhecido
   * pelo ModelManager.
   */
  static getActiveVersion():
    number | null {
    return ModelManager
      .getActiveVersion();
  }

  /**
   * Retorna um relatório resumido do treinamento.
   */
  static formatResult(
    training: SemanticFeedbackTrainingResult,
  ): string {
    const {
      result,
      context,
    } = training;

    const lines = [
      '=== Treinamento por Feedback Semântico ===',
      `Feedbacks utilizados: ${context.feedbackCount}`,
      `Dataset-base: ${context.trainingBaseCount} pares`,
      `Validação: ${context.validationCount} pares`,
      `Teste: ${context.testCount} pares`,
      '',
      `Versão candidata: ${result.candidateVersion}`,
      `Pares originais: ${result.originalPairs}`,
      `Hard negatives: ${result.hardNegativePairs}`,
      `Augmentation: +${result.augmentedPairs}`,
      `Total de treino: ${result.totalTrainingPairs}`,
      '',
      `F1 validação anterior: ${result.previousValidationMetrics.f1.toFixed(4)}`,
      `F1 validação candidata: ${result.candidateValidationMetrics.f1.toFixed(4)}`,
      `Accuracy validação candidata: ${result.candidateValidationMetrics.accuracy.toFixed(4)}`,
      '',
      `Status: ${
        result.activated
          ? 'ATIVADO'
          : 'REJEITADO'
      }`,
      `Motivo: ${result.reason}`,
    ];

    if (
      result.candidateTestMetrics
    ) {
      lines.push(
        '',
        `F1 teste: ${result.candidateTestMetrics.f1.toFixed(4)}`,
        `Accuracy teste: ${result.candidateTestMetrics.accuracy.toFixed(4)}`,
      );
    }

    return lines.join('\n');
  }

  private static resolveOptions(
    options: SemanticFeedbackTrainingOptions,
  ): Required<SemanticFeedbackTrainingOptions> {
    const resolved = {
      seed:
        options.seed ??
        DEFAULT_OPTIONS.seed,

      minimumFeedbackExamples:
        options.minimumFeedbackExamples ??
        DEFAULT_OPTIONS
          .minimumFeedbackExamples,

      trainRatio:
        options.trainRatio ??
        DEFAULT_OPTIONS
          .trainRatio,

      validationRatio:
        options.validationRatio ??
        DEFAULT_OPTIONS
          .validationRatio,
    };

    if (
      !Number.isFinite(
        resolved.seed,
      )
    ) {
      resolved.seed =
        DEFAULT_OPTIONS.seed;
    }

    resolved.minimumFeedbackExamples =
      Math.max(
        1,
        Math.floor(
          Number.isFinite(
            resolved.minimumFeedbackExamples,
          )
            ? resolved.minimumFeedbackExamples
            : DEFAULT_OPTIONS
                .minimumFeedbackExamples,
        ),
      );

    resolved.trainRatio =
      this.clampRatio(
        resolved.trainRatio,
        DEFAULT_OPTIONS.trainRatio,
      );

    resolved.validationRatio =
      this.clampRatio(
        resolved.validationRatio,
        DEFAULT_OPTIONS
          .validationRatio,
      );

    const testRatio =
      1 -
      resolved.trainRatio -
      resolved.validationRatio;

    if (
      testRatio <= 0
    ) {
      resolved.trainRatio =
        DEFAULT_OPTIONS.trainRatio;

      resolved.validationRatio =
        DEFAULT_OPTIONS
          .validationRatio;
    }

    return resolved;
  }

  private static clampRatio(
    value: number,
    fallback: number,
  ): number {
    if (
      !Number.isFinite(value)
    ) {
      return fallback;
    }

    return Math.max(
      0.01,
      Math.min(
        0.98,
        value,
      ),
    );
  }
}