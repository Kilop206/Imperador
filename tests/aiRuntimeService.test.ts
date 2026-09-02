import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIRuntimeService,
} from '../src/intelligence/aiRuntimeService';

import {
  IntentClassifier,
} from '../src/intelligence/intentClassifier';

import {
  SemanticCandidateService,
} from '../src/intelligence/semanticCandidateService';

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
  'AIRuntimeService analisa um par semântico',
  () => {
    AIRuntimeService.initialize();

    const result =
      AIRuntimeService.analyzeSemanticPair(
        'como você está?',
        'como você se sente?',
      );

    assert.ok(result);

    assert.ok(result.input);

    assert.equal(
      result.input.first,
      'como você está?',
    );

    assert.equal(
      result.input.second,
      'como você se sente?',
    );

    assert.equal(
      typeof result.input.semanticScore,
      'number',
    );

    assert.ok(
      result.input.semanticScore >= 0,
    );

    assert.ok(
      result.input.semanticScore <= 1,
    );

    assert.ok(result.score);

    assert.equal(
      typeof result.score.uncertainty,
      'number',
    );

    assert.equal(
      typeof result.score.novelty,
      'number',
    );

    assert.equal(
      typeof result.score.disagreement,
      'number',
    );

    assert.equal(
      typeof result.score.collectionScore,
      'number',
    );

    if (result.candidate) {
      assert.equal(
        typeof result.candidate.id,
        'number',
      );

      assert.equal(
        result.candidate.reviewed,
        false,
      );
    }
  },
);

test(
  'AIRuntimeService expõe candidatos semânticos pendentes',
  () => {
    AIRuntimeService.initialize();

    const candidates =
      AIRuntimeService
        .getPendingSemanticCandidates();

    assert.ok(
      Array.isArray(candidates),
    );

    const count =
      AIRuntimeService
        .getPendingSemanticCandidateCount();

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
  'AIRuntimeService pode aprovar um candidato semântico',
  () => {
    AIRuntimeService.initialize();

    const first =
      `teste positivo runtime ${Date.now()}`;

    const second =
      `teste semelhante runtime ${Date.now()}`;

    const candidate =
      SemanticCandidateService.collect(
        first,
        second,
        0.5,
        'uncertain',
      );

    assert.ok(candidate);

    const candidateId =
      candidate.id;

    const approved =
      AIRuntimeService
        .approveSemanticCandidate(
          candidateId,
          1,
        );

    assert.equal(
      approved,
      true,
    );

    const reviewed =
      SemanticCandidateService
        .getById(
          candidateId,
        );

    assert.ok(reviewed);

    assert.equal(
      reviewed.reviewed,
      true,
    );

    assert.equal(
      SemanticFeedbackService.hasPair(
        first,
        second,
        1,
      ),
      true,
    );
  },
);

test(
  'AIRuntimeService pode rejeitar um candidato semântico',
  () => {
    AIRuntimeService.initialize();

    const first =
      `teste rejeitado runtime ${Date.now()}`;

    const second =
      `teste sem relação runtime ${Date.now()}`;

    const candidate =
      SemanticCandidateService.collect(
        first,
        second,
        0.5,
        'uncertain',
      );

    assert.ok(candidate);

    const candidateId =
      candidate.id;

    const rejected =
      AIRuntimeService
        .rejectSemanticCandidate(
          candidateId,
        );

    assert.equal(
      rejected,
      true,
    );

    const reviewed =
      SemanticCandidateService
        .getById(
          candidateId,
        );

    assert.ok(reviewed);

    assert.equal(
      reviewed.reviewed,
      true,
    );

    assert.equal(
      SemanticFeedbackService.hasPair(
        first,
        second,
      ),
      false,
    );
  },
);

test(
  'AIRuntimeService expõe preview do treinamento semântico',
  () => {
    AIRuntimeService.initialize();

    const feedbackCount =
      SemanticFeedbackService.getCount();

    if (
      feedbackCount === 0
    ) {
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
  },
);

test(
  'AIRuntimeService pode preparar o ciclo semântico com segurança',
  () => {
    AIRuntimeService.initialize();

    const feedbackCount =
      SemanticFeedbackService.getCount();

    if (
      feedbackCount === 0
    ) {
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