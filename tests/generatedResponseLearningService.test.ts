import assert from 'node:assert/strict';
import test from 'node:test';

import { GeneratedResponseFeedbackService } from '../src/intelligence/generatedResponseFeedbackService';
import { GeneratedResponseLearningService } from '../src/intelligence/generatedResponseLearningService';
import { ResponseGenerationEngine } from '../src/intelligence/responseGenerationEngine';
import { EMOTION_BASELINE } from '../src/types/emotion';

function generated(text: string) {
  return {
    text,
    confidence: 0.90,
    novelty: 0.90,
    relevance: 0.90,
    contextRelevance: 0.90,
    intentAlignment: 0.90,
  };
}

test.beforeEach(() => {
  GeneratedResponseFeedbackService.reset({ persist: false });
  GeneratedResponseLearningService.reset();
});

test('aplica somente feedback positivo elegível', () => {
  const engine = new ResponseGenerationEngine();

  engine.initialize();

  const before = engine.getTrainingSentenceCount();

  const id = GeneratedResponseFeedbackService.register({
    content: 'fale sobre roma',
    intent: 'roman',
    emotion: { ...EMOTION_BASELINE },
    generated: generated('Roma recorda o poder do império eterno.'),
  });

  const approved = GeneratedResponseFeedbackService.recordFeedback(
    id,
    'positive',
  );

  assert.ok(approved?.trainingEligible);

  const result = GeneratedResponseLearningService.applyEligible(engine);

  assert.equal(result.applied, 1);
  assert.equal(
    engine.getTrainingSentenceCount(),
    before + 1,
  );
});

test('não aplica novamente o mesmo feedback', () => {
  const engine = new ResponseGenerationEngine();

  const id = GeneratedResponseFeedbackService.register({
    content: 'fale sobre roma',
    intent: 'roman',
    emotion: { ...EMOTION_BASELINE },
    generated: generated('Roma recorda o poder do império eterno.'),
  });

  GeneratedResponseFeedbackService.recordFeedback(id, 'positive');

  const first = GeneratedResponseLearningService.applyEligible(engine);
  const second = GeneratedResponseLearningService.applyEligible(engine);

  assert.equal(first.applied, 1);
  assert.equal(second.applied, 0);
  assert.equal(second.skipped, 1);
});

test('não aprende feedback negativo', () => {
  const engine = new ResponseGenerationEngine();

  const id = GeneratedResponseFeedbackService.register({
    content: 'fale sobre roma',
    intent: 'roman',
    emotion: { ...EMOTION_BASELINE },
    generated: generated('Roma recorda o poder do império eterno.'),
  });

  GeneratedResponseFeedbackService.recordFeedback(id, 'negative');
  const before = engine.getTrainingSentenceCount();
  const result = GeneratedResponseLearningService.applyEligible(engine);

  assert.equal(result.applied, 0);
  assert.equal(engine.getTrainingSentenceCount(), before);
});
