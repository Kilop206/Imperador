import {
  ModelManager,
} from './modelManager';

import {
  SemanticFeedbackService,
} from './semanticFeedbackService';

import {
  SEMANTIC_SENTENCE_DATASET,
  type SemanticSentencePair,
} from './semanticSentenceDataset';

import {
  splitSemanticDataset,
  type SemanticDatasetSplit,
} from './semanticDatasetSplit';

import type {
  SemanticFineTuningInput,
  SemanticFineTuningResult,
} from './semanticFineTuningService';

export interface SemanticFeedbackTrainingOptions {
  seed?: number;
  minimumFeedbackExamples?: number;
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

export interface SemanticFeedbackTrainingPreparation {
  input: SemanticFineTuningInput;
  context: SemanticFeedbackTrainingContext;
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
  static prepareTraining(
    options: SemanticFeedbackTrainingOptions = {},
  ): SemanticFeedbackTrainingPreparation {
    const resolved =
      this.resolveOptions(options);

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

    const trainingDataset:
      SemanticSentencePair[] = [
      ...split.train,
      ...feedback,
    ];

    const input:
      SemanticFineTuningInput = {
      originalDataset:
        trainingDataset,

      validationDataset:
        split.validation,

      testDataset:
        split.test,
    };

    return {
      input,

      context: {
        feedbackCount:
          feedback.length,

        trainingBaseCount:
          split.train.length,

        validationCount:
          split.validation.length,

        testCount:
          split.test.length,

        split,
      },
    };
  }

  static train(
    options: SemanticFeedbackTrainingOptions = {},
  ): SemanticFeedbackTrainingResult {
    const preparation =
      this.prepareTraining(
        options,
      );

    const result =
      ModelManager.fineTune(
        preparation.input,
      );

    return {
      result,
      context:
        preparation.context,
    };
  }

  static preview(
    options: SemanticFeedbackTrainingOptions = {},
  ): SemanticFeedbackTrainingContext {
    return this.prepareTraining(
      options,
    ).context;
  }

  static getFeedbackCount(): number {
    return SemanticFeedbackService
      .getCount();
  }

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

  static getActiveVersion():
    number | null {
    return ModelManager
      .getActiveVersion();
  }

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
      `Dataset-base no treino: ${context.trainingBaseCount} pares`,
      `Total efetivo de treino: ${result.totalTrainingPairs} pares`,
      `Validação: ${context.validationCount} pares`,
      `Teste: ${context.testCount} pares`,
      '',
      `Versão candidata: ${result.candidateVersion}`,
      `Pares originais: ${result.originalPairs}`,
      `Hard negatives: ${result.hardNegativePairs}`,
      `Augmentation: +${result.augmentedPairs}`,
      `Total de treino reportado: ${result.totalTrainingPairs}`,
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