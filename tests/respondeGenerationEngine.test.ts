import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ResponseGenerationEngine,
} from '../src/intelligence/responseGenerationEngine';

import {
  EMOTION_BASELINE,
} from '../src/types/emotion';

const neutralEmotion = () => ({
  ...EMOTION_BASELINE,
});

test('inicializa o modelo e carrega o vocabulário', () => {
  const engine = new ResponseGenerationEngine();

  assert.equal(engine.isInitialized(), false);
  engine.initialize();

  assert.equal(engine.isInitialized(), true);
  assert.ok(engine.getTrainingSentenceCount() > 0);
  assert.ok(engine.getVocabularySize() > 0);
});

test('inspeção contextual separa entrada, memória e contexto semântico', () => {
  const engine = new ResponseGenerationEngine();

  const profile = engine.inspectContext({
    content: 'fale sobre Roma',
    intent: 'question',
    emotion: neutralEmotion(),
    relevantMemory: 'O usuário estudou Roma e o Império Romano',
    semanticContext: 'Contexto lembrado: Roma e Império Romano',
  });

  assert.ok(profile.inputTokens.includes('roma'));
  assert.ok(profile.memoryTokens.includes('roma'));
  assert.ok(profile.semanticTokens.includes('roma'));
  assert.ok(profile.priorityTokens.has('roma'));
});

test('emoção elevada adiciona sinais de estilo ao perfil de geração', () => {
  const engine = new ResponseGenerationEngine();

  const profile = engine.inspectContext({
    content: 'conte uma piada',
    intent: 'humor',
    emotion: {
      ...neutralEmotion(),
      amusement: 90,
    },
  });

  assert.ok(profile.styleTokens.has('interessante') || profile.styleTokens.has('hahaha'));
});

test('geração contextual retorna métricas de relevância contextual e intenção', () => {
  const engine = new ResponseGenerationEngine();

  const generated = engine.generate({
    content: 'Roma',
    intent: 'roman',
    emotion: neutralEmotion(),
    relevantMemory: 'O usuário falou sobre Roma e o Império',
    semanticContext: 'Memória semântica relacionada a Roma',
  });

  assert.ok(generated !== null);
  assert.ok(generated.contextRelevance >= 0);
  assert.ok(generated.contextRelevance <= 1);
  assert.ok(generated.intentAlignment >= 0);
  assert.ok(generated.intentAlignment <= 1);
  assert.ok(generated.confidence >= 0);
  assert.ok(generated.confidence <= 1);
});

test('memória e contexto semântico participam da seleção contextual', () => {
  const engine = new ResponseGenerationEngine();

  const profileWithoutContext = engine.inspectContext({
    content: 'explique isso',
    intent: 'question',
    emotion: neutralEmotion(),
  });

  const profileWithContext = engine.inspectContext({
    content: 'explique isso',
    intent: 'question',
    emotion: neutralEmotion(),
    relevantMemory: 'Roma foi um tema importante para o usuário',
    semanticContext: 'Contexto sobre Roma e o Império Romano',
  });

  assert.ok(
    profileWithContext.priorityTokens.size >=
      profileWithoutContext.priorityTokens.size,
  );
  assert.ok(profileWithContext.priorityTokens.has('roma'));
});
