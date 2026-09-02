import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIRuntimeService,
} from '../src/intelligence/aiRuntimeService';

import {
  IntentClassifier,
} from '../src/intelligence/intentClassifier';

import {
  SemanticFeedbackService,
} from '../src/intelligence/semanticFeedbackService';

test(
  'AIRuntimeService inicializa corretamente',
  () => {
    AIRuntimeService.initialize();

    assert.equal(
      AIRuntimeService.isInitialized(),
      true,
    );

    assert.equal(
      IntentClassifier.isTrained(),
      true,
    );
  },
);

test(
  'AIRuntimeService retorna uma análise de intenção válida',
  () => {
    AIRuntimeService.initialize();

    const result =
      AIRuntimeService.analyzeIntent(
        'olá, tudo bem?',
      );

    assert.ok(result);

    assert.ok(result.prediction);

    assert.equal(
      typeof result.prediction.intent,
      'string',
    );

    assert.equal(
      typeof result.prediction.confidence,
      'number',
    );

    assert.ok(
      result.prediction.confidence >= 0,
    );

    assert.ok(
      result.prediction.confidence <= 1,
    );

    assert.ok(result.activeLearning);

    assert.equal(
      typeof result.activeLearning.score,
      'number',
    );
  },
);

test(
  'AIRuntimeService expõe o estado do runtime',
  () => {
    AIRuntimeService.initialize();

    const status =
      AIRuntimeService.getStatus();

    assert.equal(
      status.initialized,
      true,
    );

    assert.equal(
      typeof status.intent.trained,
      'boolean',
    );

    assert.equal(
      typeof status.intent.vocabularySize,
      'number',
    );

    assert.equal(
      typeof status.intent.trainingExamples,
      'number',
    );

    assert.equal(
      typeof status.intent.learnedExamples,
      'number',
    );

    assert.equal(
      typeof status.intent.totalExamples,
      'number',
    );

    assert.equal(
      typeof status.intent.pendingCandidates,
      'number',
    );

    assert.ok(
      status.semantic,
    );
  },
);

test(
  'AIRuntimeService retorna candidatos de intenção',
  () => {
    AIRuntimeService.initialize();

    const candidates =
      AIRuntimeService
        .getPendingIntentCandidates();

    assert.ok(
      Array.isArray(candidates),
    );

    const count =
      AIRuntimeService
        .getPendingIntentCandidateCount();

    assert.equal(
      typeof count,
      'number',
    );

    assert.ok(
      count >= 0,
    );
  },
);

test(
  'AIRuntimeService permite obter uma predição diretamente',
  () => {
    AIRuntimeService.initialize();

    const prediction =
      AIRuntimeService.getIntentPrediction(
        'isso é uma pergunta?',
      );

    assert.ok(prediction);

    assert.equal(
      typeof prediction.intent,
      'string',
    );

    assert.equal(
      typeof prediction.confidence,
      'number',
    );

    assert.ok(
      prediction.confidence >= 0,
    );

    assert.ok(
      prediction.confidence <= 1,
    );
  },
);

test(
  'AIRuntimeService expõe preview do treinamento semântico',
  () => {
    AIRuntimeService.initialize();

    const feedbackCount =
      SemanticFeedbackService.getCount();

    if (feedbackCount === 0) {
      assert.throws(
        () =>
          AIRuntimeService
            .previewSemanticTraining(),
        /feedback semântico/i,
      );

      return;
    }

    const preview =
      AIRuntimeService
        .previewSemanticTraining();

    assert.ok(preview);

    assert.equal(
      preview.feedbackCount,
      feedbackCount,
    );

    assert.equal(
      preview.trainingBaseCount,
      preview.split.train.length,
    );

    assert.equal(
      preview.validationCount,
      preview.split.validation.length,
    );

    assert.equal(
      preview.testCount,
      preview.split.test.length,
    );

    assert.ok(
      preview.split.train.length > 0,
    );

    assert.ok(
      preview.split.validation.length > 0,
    );

    assert.ok(
      preview.split.test.length > 0,
    );
  },
);

test(
  'AIRuntimeService pode preparar o ciclo semântico com segurança',
  () => {
    AIRuntimeService.initialize();

    const feedbackCount =
      SemanticFeedbackService.getCount();

    if (feedbackCount === 0) {
      assert.throws(
        () =>
          AIRuntimeService
            .trainSemanticFromFeedback(),
        /feedback semântico/i,
      );

      return;
    }

    const result =
      AIRuntimeService
        .trainSemanticFromFeedback();

    assert.ok(result);

    assert.ok(
      result.context,
    );

    assert.ok(
      result.safeFineTuning,
    );

    assert.equal(
      typeof result.safeFineTuning.rolledBack,
      'boolean',
    );

    assert.equal(
      typeof result.safeFineTuning.previousActiveVersion,
      'number',
    );

    assert.equal(
      typeof result.safeFineTuning.finalActiveVersion,
      'number',
    );
  },
);

test(
  'AIRuntimeService pode ser reinicializado',
  () => {
    AIRuntimeService.initialize();

    assert.equal(
      AIRuntimeService.isInitialized(),
      true,
    );

    AIRuntimeService.reset();

    assert.equal(
      AIRuntimeService.isInitialized(),
      false,
    );

    AIRuntimeService.initialize();

    assert.equal(
      AIRuntimeService.isInitialized(),
      true,
    );
  },
);