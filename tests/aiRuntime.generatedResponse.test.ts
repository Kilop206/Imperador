import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIRuntimeService,
} from '../src/intelligence/aiRuntimeService';

import {
  ResponseEngine,
} from '../src/services/responseEngine';

import {
  GeneratedResponseFeedbackService,
} from '../src/intelligence/generatedResponseFeedbackService';

import {
  GeneratedResponseLearningService,
} from '../src/intelligence/generatedResponseLearningService';

import {
  EMOTION_BASELINE,
} from '../src/types/emotion';

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
  GeneratedResponseFeedbackService.reset({
    persist: false,
  });

  GeneratedResponseLearningService.reset();

  AIRuntimeService.reset();
});

test(
  'AIRuntimeService integra o aprendizado de respostas geradas',
  () => {
    AIRuntimeService.initialize();

    const engine =
      ResponseEngine
        .getResponseGenerationEngine();

    const before =
      engine.getTrainingSentenceCount();

    const id =
      GeneratedResponseFeedbackService.register({
        content:
          'fale sobre roma',
        intent:
          'roman',
        emotion:
          { ...EMOTION_BASELINE },
        generated:
          generated(
            'Roma recorda o poder do império eterno.',
          ),
      });

    const feedback =
      GeneratedResponseFeedbackService
        .recordFeedback(
          id,
          'positive',
        );

    assert.ok(
      feedback?.trainingEligible,
    );

    const result =
      AIRuntimeService
        .trainGeneratedResponses();

    assert.equal(
      result.learning.applied,
      1,
    );

    assert.equal(
      result.trainingSentenceCount,
      before + 1,
    );

    assert.equal(
      ResponseEngine
        .getResponseGenerationEngine()
        .getTrainingSentenceCount(),
      before + 1,
    );
  },
);
