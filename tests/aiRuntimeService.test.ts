import assert from 'node:assert/strict';
import test from 'node:test';

import {
AIRuntimeService,
} from '../src/intelligence/aiRuntimeService';

import {
IntentClassifier,
} from '../src/intelligence/intentClassifier';

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
