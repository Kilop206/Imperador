import assert from 'node:assert/strict';
import test from 'node:test';

import { EMOTION_BASELINE } from '../src/types/emotion';
import {
  GeneratedResponseFeedbackService,
} from '../src/intelligence/generatedResponseFeedbackService';

function createInput() {
  return {
    content: 'Roma ainda é poderosa?',
    intent: 'question' as const,
    emotion: { ...EMOTION_BASELINE },
    relevantMemory: 'O usuário perguntou sobre Roma ontem.',
    semanticContext: 'Roma e o poder imperial.',
    generated: {
      text: 'Roma permanece digna enquanto houver poder e ordem.',
      confidence: 0.82,
      novelty: 0.78,
      relevance: 0.72,
      contextRelevance: 0.80,
      intentAlignment: 0.65,
    },
  };
}

test('registra resposta gerada e cria avaliação própria', () => {
  GeneratedResponseFeedbackService.reset();

  const id = GeneratedResponseFeedbackService.register(createInput());
  const entry = GeneratedResponseFeedbackService.get(id);

  assert.ok(id.startsWith('genfb_'));
  assert.ok(entry);
  assert.equal(entry?.feedback, null);
  assert.equal(entry?.trainingEligible, false);
  assert.ok(entry?.selfEvaluationId);
  assert.ok((entry?.selfEvaluationQuality ?? 0) >= 0);
});

test('feedback positivo qualificado torna a resposta elegível para treinamento', () => {
  GeneratedResponseFeedbackService.reset();

  const id = GeneratedResponseFeedbackService.register(createInput());
  const entry = GeneratedResponseFeedbackService.recordFeedback(
    id,
    'positive',
    { score: 1, note: 'Resposta adequada.' },
  );

  assert.ok(entry);
  assert.equal(entry?.feedback?.label, 'positive');
  assert.equal(entry?.trainingEligible, true);
});

test('feedback negativo nunca torna a resposta elegível', () => {
  GeneratedResponseFeedbackService.reset();

  const id = GeneratedResponseFeedbackService.register(createInput());
  const entry = GeneratedResponseFeedbackService.recordFeedback(
    id,
    'negative',
    { score: 1 },
  );

  assert.ok(entry);
  assert.equal(entry?.feedback?.label, 'negative');
  assert.equal(entry?.trainingEligible, false);
});

test('resposta pendente só deixa a fila após feedback explícito', () => {
  GeneratedResponseFeedbackService.reset();

  const id = GeneratedResponseFeedbackService.register(createInput());

  assert.equal(
    GeneratedResponseFeedbackService.listPending().length,
    1,
  );

  GeneratedResponseFeedbackService.recordFeedback(id, 'neutral');

  assert.equal(
    GeneratedResponseFeedbackService.listPending().length,
    0,
  );
});

test('estatísticas acompanham estado do feedback', () => {
  GeneratedResponseFeedbackService.reset();

  const first = GeneratedResponseFeedbackService.register(createInput());
  const second = GeneratedResponseFeedbackService.register(createInput());

  GeneratedResponseFeedbackService.recordFeedback(first, 'positive');
  GeneratedResponseFeedbackService.recordFeedback(second, 'negative');

  const stats = GeneratedResponseFeedbackService.getStats();

  assert.equal(stats.total, 2);
  assert.equal(stats.pending, 0);
  assert.equal(stats.positive, 1);
  assert.equal(stats.negative, 1);
});

test('reset limpa completamente o registro de feedback', () => {
  GeneratedResponseFeedbackService.reset();
  GeneratedResponseFeedbackService.register(createInput());

  GeneratedResponseFeedbackService.reset();

  assert.deepEqual(
    GeneratedResponseFeedbackService.getStats(),
    {
      total: 0,
      pending: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      trainingEligible: 0,
      averageSelfEvaluationQuality: 0,
      averageConfidence: 0,
    },
  );
});
