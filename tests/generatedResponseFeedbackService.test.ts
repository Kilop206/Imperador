import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { afterEach, beforeEach } from 'node:test';

import {
  GeneratedResponseFeedbackService,
} from '../src/intelligence/generatedResponseFeedbackService';
import type { EmotionState } from '../src/types/emotion';
import type { GeneratedResponse } from '../src/intelligence/responseGenerationEngine';

const testStoragePath = join(
  tmpdir(),
  'imperador-generated-response-feedback-test.json',
);

const emotion: EmotionState = {
  irritation: 10,
  respect: 50,
  trust: 40,
  nostalgia: 20,
  curiosity: 30,
  hostility: 5,
  amusement: 20,
};

const generated: GeneratedResponse = {
  text: 'Roma observa e o império responde com autoridade.',
  confidence: 0.90,
  novelty: 0.90,
  relevance: 0.90,
  contextRelevance: 0.90,
  intentAlignment: 0.90,
  feedbackId: undefined,
};

beforeEach(() => {
  rmSync(testStoragePath, { force: true });
  GeneratedResponseFeedbackService.setStoragePathForTests(
    testStoragePath,
  );
  GeneratedResponseFeedbackService.reset({ persist: false });
});

afterEach(() => {
  rmSync(testStoragePath, { force: true });
  GeneratedResponseFeedbackService.resetStoragePath();
});

test('persiste uma resposta registrada no armazenamento', () => {
  const id = GeneratedResponseFeedbackService.register({
    content: 'Fale sobre Roma',
    intent: 'roman',
    emotion,
    generated,
  });

  assert.equal(typeof id, 'string');
  assert.equal(existsSync(testStoragePath), true);
});

test('recupera feedback após reinicialização do serviço', () => {
  const id = GeneratedResponseFeedbackService.register({
    content: 'Fale sobre Roma',
    intent: 'roman',
    emotion,
    generated,
  });

  GeneratedResponseFeedbackService.setStoragePathForTests(
    testStoragePath,
  );
  GeneratedResponseFeedbackService.initialize();

  const recovered =
    GeneratedResponseFeedbackService.get(id);

  assert.ok(recovered);
  assert.equal(recovered?.responseText, generated.text);
  assert.equal(recovered?.intent, 'roman');
});

test('persiste feedback positivo e mantém elegibilidade', () => {
  const id = GeneratedResponseFeedbackService.register({
    content: 'Fale sobre Roma',
    intent: 'roman',
    emotion,
    generated,
  });

  const updated =
    GeneratedResponseFeedbackService.recordFeedback(
      id,
      'positive',
      { score: 1 },
    );

  assert.equal(updated?.trainingEligible, true);

  GeneratedResponseFeedbackService.setStoragePathForTests(
    testStoragePath,
  );
  GeneratedResponseFeedbackService.initialize();

  const recovered =
    GeneratedResponseFeedbackService.get(id);

  assert.equal(recovered?.feedback?.label, 'positive');
  assert.equal(recovered?.trainingEligible, true);
});

test('feedback negativo permanece inelegível após persistência', () => {
  const id = GeneratedResponseFeedbackService.register({
    content: 'Fale sobre Roma',
    intent: 'roman',
    emotion,
    generated,
  });

  const updated =
    GeneratedResponseFeedbackService.recordFeedback(
      id,
      'negative',
    );

  assert.equal(updated?.trainingEligible, false);

  GeneratedResponseFeedbackService.setStoragePathForTests(
    testStoragePath,
  );
  GeneratedResponseFeedbackService.initialize();

  const recovered =
    GeneratedResponseFeedbackService.get(id);

  assert.equal(recovered?.feedback?.label, 'negative');
  assert.equal(recovered?.trainingEligible, false);
});

test('limita o histórico persistido ao máximo configurado', () => {
  for (let index = 0; index < 510; index += 1) {
    GeneratedResponseFeedbackService.register({
      content: `Fale sobre Roma ${index}`,
      intent: 'roman',
      emotion,
      generated,
    });
  }

  const stats = GeneratedResponseFeedbackService.getStats();

  assert.equal(stats.total, 500);

  GeneratedResponseFeedbackService.setStoragePathForTests(
    testStoragePath,
  );
  GeneratedResponseFeedbackService.initialize();

  assert.equal(
    GeneratedResponseFeedbackService.getStats().total,
    500,
  );
});
