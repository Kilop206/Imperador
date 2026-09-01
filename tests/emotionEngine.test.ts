import { strict as assert } from 'node:assert';
import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import { EmotionEngine } from '../src/intelligence/emotionEngine';
import { MemoryService } from '../src/services/memoryService';
import { TextAnalyzer } from '../src/services/textAnalyzer';
import {
  emotionState,
  resetEmotions,
  snapshotEmotions,
} from '../src/state/emotionState';
import {
  EMOTION_BASELINE,
  EMOTION_MAX,
  EMOTION_MIN,
} from '../src/types/emotion';

beforeEach(() => {
  resetEmotions();
  MemoryService.close();
  MemoryService.initialize(':memory:');
});

afterEach(() => {
  MemoryService.close();
});

// ─── Limites ──────────────────────────────────────────────────────────────────

test('emoções iniciam no baseline', () => {
  const state = EmotionEngine.getState();

  for (const [key, baseline] of Object.entries(
    EMOTION_BASELINE
  )) {
    assert.equal(
      state[key as keyof typeof state],
      baseline,
      `${key} deve ser ${baseline} no baseline`
    );
  }
});

test('emoção não ultrapassa EMOTION_MAX', () => {
  // Força 100 aumentos grandes
  for (let i = 0; i < 100; i++) {
    EmotionEngine.applyDeltas({ irritation: 10 });
  }

  assert.equal(
    emotionState.irritation,
    EMOTION_MAX
  );
});

test('emoção não cai abaixo de EMOTION_MIN', () => {
  for (let i = 0; i < 100; i++) {
    EmotionEngine.applyDeltas({ amusement: -10 });
  }

  assert.equal(
    emotionState.amusement,
    EMOTION_MIN
  );
});

// ─── Interações ───────────────────────────────────────────────────────────────

test('elogio aumenta respect e trust', () => {
  const before = snapshotEmotions();

  const analysis = TextAnalyzer.analyze(
    'Tibério é incrível e admirável'
  );

  EmotionEngine.processMessage(analysis);

  assert.ok(
    emotionState.respect > before.respect,
    'respect deve aumentar com elogio'
  );

  assert.ok(
    emotionState.trust > before.trust,
    'trust deve aumentar com elogio'
  );
});

test('elogio reduz hostilidade', () => {
  // Sobe a hostilidade primeiro
  EmotionEngine.applyDeltas({ hostility: 30 });

  const before = snapshotEmotions();

  const analysis = TextAnalyzer.analyze(
    'Tibério é fantástico e extraordinário'
  );

  EmotionEngine.processMessage(analysis);

  assert.ok(
    emotionState.hostility < before.hostility,
    'hostility deve cair com elogio'
  );
});

test('insulto aumenta irritation e hostility', () => {
  const before = snapshotEmotions();

  const analysis = TextAnalyzer.analyze(
    'você é um idiota completo'
  );

  EmotionEngine.processMessage(analysis);

  assert.ok(
    emotionState.irritation > before.irritation,
    'irritation deve aumentar com insulto'
  );

  assert.ok(
    emotionState.hostility > before.hostility,
    'hostility deve aumentar com insulto'
  );
});

test('insulto reduz trust', () => {
  const before = snapshotEmotions();

  const analysis = TextAnalyzer.analyze(
    'você é um burro inútil'
  );

  EmotionEngine.processMessage(analysis);

  assert.ok(
    emotionState.trust < before.trust,
    'trust deve cair com insulto'
  );
});

test('pergunta aumenta curiosidade', () => {
  const before = snapshotEmotions();

  const analysis = TextAnalyzer.analyze(
    'Por que Roma caiu?'
  );

  EmotionEngine.processMessage(analysis);

  assert.ok(
    emotionState.curiosity > before.curiosity,
    'curiosity deve aumentar com pergunta'
  );
});

test('humor aumenta amusement', () => {
  const before = snapshotEmotions();

  const analysis = TextAnalyzer.analyze(
    'kkkk que piada boa hahaha'
  );

  EmotionEngine.processMessage(analysis);

  assert.ok(
    emotionState.amusement > before.amusement,
    'amusement deve aumentar com humor'
  );
});

test('assunto nostálgico aumenta nostalgia', () => {
  const before = snapshotEmotions();

  const analysis = TextAnalyzer.analyze(
    'aquela saudade do passado, memórias da infância'
  );

  EmotionEngine.processMessage(analysis);

  assert.ok(
    emotionState.nostalgia > before.nostalgia,
    'nostalgia deve aumentar com tema nostálgico'
  );
});

test('assunto filosófico aumenta curiosidade', () => {
  const before = snapshotEmotions();

  const analysis = TextAnalyzer.analyze(
    'qual é o sentido da existência?'
  );

  EmotionEngine.processMessage(analysis);

  assert.ok(
    emotionState.curiosity > before.curiosity,
    'curiosity deve aumentar com tema filosófico'
  );
});

// ─── Decaimento ───────────────────────────────────────────────────────────────

test('irritação decai de volta ao baseline após vários ticks', () => {
  // Sobe irritação bem acima do baseline
  EmotionEngine.applyDeltas({ irritation: 50 });

  const elevated = emotionState.irritation;

  assert.ok(
    elevated > EMOTION_BASELINE.irritation,
    'irritação deve ter subido'
  );

  // Aplica 60 ticks de decay (cada tick reduz 2)
  EmotionEngine.decayTicks(60);

  assert.equal(
    emotionState.irritation,
    EMOTION_BASELINE.irritation,
    'irritação deve ter decaído ao baseline'
  );
});

test('decaimento não ultrapassa o baseline', () => {
  // Parte do baseline e aplica muitos ticks
  EmotionEngine.decayTicks(200);

  assert.equal(
    emotionState.irritation,
    EMOTION_BASELINE.irritation,
    'irritação não deve cair abaixo do baseline'
  );
});

test('emoção abaixo do baseline sobe de volta', () => {
  // Força respeito para baixo
  EmotionEngine.applyDeltas({ respect: -45 });

  const lowered = emotionState.respect;

  assert.ok(
    lowered < EMOTION_BASELINE.respect,
    'respect deve ter caído abaixo do baseline'
  );

  // Decay deve empurrar de volta para cima
  EmotionEngine.decayTicks(30);

  assert.ok(
    emotionState.respect > lowered,
    'respect deve ter subido em direção ao baseline'
  );
});

test('um único tick de decay move exatamente DECAY_RATE', () => {
  // Define irritação muito acima do baseline
  EmotionEngine.applyDeltas({ irritation: 50 });

  const before = emotionState.irritation;

  EmotionEngine.decay();

  // Deve ter se aproximado do baseline por exatamente DECAY_RATE=2
  assert.equal(
    emotionState.irritation,
    before - 2,
    'um tick deve reduzir em 2'
  );
});

// ─── Persistência ─────────────────────────────────────────────────────────────

test('salva e carrega estado emocional via MemoryService', () => {
  EmotionEngine.applyDeltas({
    irritation: 20,
    respect:    -10,
    curiosity:   15,
  });

  const snapshot = EmotionEngine.getState();

  MemoryService.saveEmotions(snapshot);

  // Reseta o estado em memória
  resetEmotions();

  assert.equal(
    emotionState.irritation,
    EMOTION_BASELINE.irritation,
    'state deve ter sido resetado'
  );

  // Restaura do banco
  const loaded = MemoryService.loadEmotions();

  const { restoreEmotions } = require(
    '../src/state/emotionState'
  );

  restoreEmotions(loaded);

  assert.equal(
    emotionState.irritation,
    snapshot.irritation,
    'irritation deve ter sido restaurado'
  );

  assert.equal(
    emotionState.respect,
    snapshot.respect,
    'respect deve ter sido restaurado'
  );

  assert.equal(
    emotionState.curiosity,
    snapshot.curiosity,
    'curiosity deve ter sido restaurado'
  );
});

test('loadEmotions retorna {} quando banco está vazio', () => {
  const loaded = MemoryService.loadEmotions();

  assert.ok(
    typeof loaded === 'object',
    'deve retornar objeto'
  );

  assert.equal(
    Object.keys(loaded).length,
    0,
    'deve retornar objeto vazio'
  );
});

test('saveEmotions sobrescreve valores anteriores', () => {
  MemoryService.saveEmotions({
    irritation: 30,
    respect: 40,
    trust: 50,
    nostalgia: 20,
    curiosity: 35,
    hostility: 10,
    amusement: 25,
  });

  MemoryService.saveEmotions({
    irritation: 55,
    respect: 70,
    trust: 60,
    nostalgia: 30,
    curiosity: 45,
    hostility: 5,
    amusement: 50,
  });

  const loaded = MemoryService.loadEmotions();

  assert.equal(loaded.irritation, 55);
  assert.equal(loaded.respect, 70);
});

// ─── describeMood ─────────────────────────────────────────────────────────────

test('describeMood retorna neutro no baseline', () => {
  assert.equal(
    EmotionEngine.describeMood(),
    'neutro'
  );
});

test('describeMood reflete irritação elevada', () => {
  EmotionEngine.applyDeltas({ irritation: 60 });

  assert.ok(
    EmotionEngine.describeMood().includes('irritado')
  );
});

test('describeMood pode combinar múltiplos estados', () => {
  EmotionEngine.applyDeltas({
    irritation: 55,
    nostalgia:  45,
  });

  const mood = EmotionEngine.describeMood();

  assert.ok(mood.includes('irritado'));
  assert.ok(mood.includes('nostálgico'));
});
