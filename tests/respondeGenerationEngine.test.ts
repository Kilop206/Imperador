import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ResponseGenerationEngine } from '../src/intelligence/responseGenerationEngine';
import { EMOTION_BASELINE } from '../src/types/emotion';

test('treina automaticamente a partir do corpus configurado', () => {
  const engine = new ResponseGenerationEngine();
  engine.initialize();

  assert.equal(engine.isInitialized(), true);
  assert.ok(engine.getTrainingSentenceCount() > 0);
  assert.ok(engine.getVocabularySize() > 0);
});

test('gera uma resposta nova a partir do corpus do Tibério', () => {
  const engine = new ResponseGenerationEngine();
  const result = engine.generate({
    content: 'Roma é importante para o Império?',
    intent: 'question',
    emotion: { ...EMOTION_BASELINE },
  });

  assert.ok(result);
  assert.ok(result.text.length >= 12);
  assert.ok(result.confidence >= 0.52);
  assert.ok(result.novelty >= 0);
  assert.ok(result.relevance >= 0);
});
