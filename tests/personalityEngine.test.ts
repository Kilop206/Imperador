import { strict as assert } from 'node:assert';
import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import { PersonalityEngine } from '../src/intelligence/personalityEngine';
import { EmotionEngine } from '../src/intelligence/emotionEngine';
import { TIBERIUS_PERSONALITY, PERSONALITY_VIOLATIONS } from '../src/config/personality';
import { MemoryService } from '../src/services/memoryService';
import {
  resetEmotions,
  emotionState,
} from '../src/state/emotionState';
import { EMOTION_BASELINE } from '../src/types/emotion';

beforeEach(() => {
  resetEmotions();
  MemoryService.close();
  MemoryService.initialize(':memory:');
});

afterEach(() => {
  MemoryService.close();
});

// ─── Perfil canônico ──────────────────────────────────────────────────────────

test('getProfile retorna o perfil canônico de Tibério', () => {
  const profile = PersonalityEngine.getProfile();

  assert.equal(profile.authority,  90);
  assert.equal(profile.arrogance,  80);
  assert.equal(profile.empathy,    15);
  assert.ok(profile.humor > 0 && profile.humor < 50,
    'humor deve ser baixo/médio');
});

test('perfil tem valores, preferências e tabus definidos', () => {
  const profile = PersonalityEngine.getProfile();

  assert.ok(profile.values.length > 0,      'values não pode ser vazio');
  assert.ok(profile.preferences.length > 0, 'preferences não pode ser vazio');
  assert.ok(profile.taboos.length > 0,      'taboos não pode ser vazio');
});

test('speechStyle tem valores no range 0-100', () => {
  const { speechStyle } = PersonalityEngine.getProfile();

  for (const [key, val] of Object.entries(speechStyle)) {
    assert.ok(val >= 0 && val <= 100,
      `speechStyle.${key} deve estar em [0, 100]`);
  }
});

// ─── Validação de consistência ────────────────────────────────────────────────

test('isConsistent retorna true para texto imperial neutro', () => {
  assert.ok(
    PersonalityEngine.isConsistent(
      'Roma não pede permissão.'
    )
  );
});

test('isConsistent retorna true para resposta arrogante', () => {
  assert.ok(
    PersonalityEngine.isConsistent(
      'Você não é digno de minha atenção.'
    )
  );
});

test('isConsistent retorna false para pedido de desculpas', () => {
  assert.equal(
    PersonalityEngine.isConsistent('Me desculpe, errei.'),
    false
  );
});

test('isConsistent retorna false para bajulação (boa pergunta)', () => {
  assert.equal(
    PersonalityEngine.isConsistent('Boa pergunta! Deixe-me explicar.'),
    false
  );
});

test('isConsistent retorna false para "você tem razão"', () => {
  assert.equal(
    PersonalityEngine.isConsistent('Você tem razão nesse ponto.'),
    false
  );
});

test('isConsistent retorna false para "posso ajudar"', () => {
  assert.equal(
    PersonalityEngine.isConsistent('Posso ajudar com isso.'),
    false
  );
});

test('isConsistent retorna false para "com certeza"', () => {
  assert.equal(
    PersonalityEngine.isConsistent('Com certeza farei isso.'),
    false
  );
});

test('isConsistent retorna false para "vou explicar"', () => {
  assert.equal(
    PersonalityEngine.isConsistent('Vou explicar o que aconteceu.'),
    false
  );
});

test('checkViolation retorna motivo da violação', () => {
  const reason = PersonalityEngine.checkViolation(
    'Me desculpe por isso.'
  );

  assert.ok(reason !== null);
  assert.ok(reason!.length > 0);
});

test('checkViolation retorna null para texto válido', () => {
  assert.equal(
    PersonalityEngine.checkViolation(
      'O Império decide, não você.'
    ),
    null
  );
});

// ─── filterConsistent ─────────────────────────────────────────────────────────

test('filterConsistent remove respostas que violam a personalidade', () => {
  const responses = [
    'O Império é eterno.',
    'Me desculpe pela demora.',
    'Roma nunca cede.',
    'Boa pergunta, deixe-me responder.',
  ];

  const filtered = PersonalityEngine.filterConsistent(responses);

  assert.equal(filtered.length, 2);
  assert.ok(filtered.includes('O Império é eterno.'));
  assert.ok(filtered.includes('Roma nunca cede.'));
});

test('filterConsistent retorna lista vazia se tudo viola', () => {
  const responses = [
    'Me desculpe.',
    'Boa pergunta!',
    'Você tem razão.',
  ];

  assert.equal(
    PersonalityEngine.filterConsistent(responses).length,
    0
  );
});

test('filterConsistent retorna lista original se nada viola', () => {
  const responses = [
    'O Império perdura.',
    'Sua ignorância é monumental.',
    'Roma decidiu.',
  ];

  const filtered = PersonalityEngine.filterConsistent(responses);

  assert.equal(filtered.length, 3);
});

// ─── Score modifiers por emoção ───────────────────────────────────────────────

test('getScoreModifiers no baseline produz modificadores neutros/pequenos', () => {
  const mods = PersonalityEngine.getScoreModifiers(
    { ...EMOTION_BASELINE }
  );

  // No baseline nenhum modificador deve ser extremo
  assert.ok(
    Math.abs(mods.aggressiveBoost)    <= 5
  );
  assert.ok(
    Math.abs(mods.complimentModifier) <= 5
  );
  assert.ok(
    Math.abs(mods.reflectiveBoost)    <= 5
  );
  assert.ok(
    Math.abs(mods.curiosityBoost)     <= 5
  );
});

test('hostilidade alta aumenta aggressiveBoost', () => {
  EmotionEngine.applyDeltas({ hostility: 80 });

  const modsHigh = PersonalityEngine.getScoreModifiers(emotionState);

  resetEmotions();

  const modsBaseline = PersonalityEngine.getScoreModifiers(
    { ...EMOTION_BASELINE }
  );

  assert.ok(
    modsHigh.aggressiveBoost > modsBaseline.aggressiveBoost,
    'hostilidade alta deve aumentar aggressiveBoost'
  );
});

test('irritação alta reduz complimentModifier', () => {
  EmotionEngine.applyDeltas({ irritation: 70 });

  const modsIrritated = PersonalityEngine.getScoreModifiers(emotionState);

  resetEmotions();

  const modsBaseline = PersonalityEngine.getScoreModifiers(
    { ...EMOTION_BASELINE }
  );

  assert.ok(
    modsIrritated.complimentModifier <
    modsBaseline.complimentModifier,
    'irritação alta deve reduzir complimentModifier'
  );
});

test('nostalgia alta aumenta reflectiveBoost', () => {
  EmotionEngine.applyDeltas({ nostalgia: 70 });

  const modsNostalgic = PersonalityEngine.getScoreModifiers(emotionState);

  resetEmotions();

  const modsBaseline = PersonalityEngine.getScoreModifiers(
    { ...EMOTION_BASELINE }
  );

  assert.ok(
    modsNostalgic.reflectiveBoost > modsBaseline.reflectiveBoost,
    'nostalgia alta deve aumentar reflectiveBoost'
  );
});

test('curiosidade alta aumenta curiosityBoost', () => {
  EmotionEngine.applyDeltas({ curiosity: 60 });

  const modsCurious = PersonalityEngine.getScoreModifiers(emotionState);

  resetEmotions();

  const modsBaseline = PersonalityEngine.getScoreModifiers(
    { ...EMOTION_BASELINE }
  );

  assert.ok(
    modsCurious.curiosityBoost > modsBaseline.curiosityBoost,
    'curiosidade alta deve aumentar curiosityBoost'
  );
});

test('modificadores são limitados a faixas razoáveis', () => {
  // Estado extremo
  EmotionEngine.applyDeltas({
    hostility:  90,
    irritation: 80,
    nostalgia:  70,
    curiosity:  65,
  });

  const mods = PersonalityEngine.getScoreModifiers(emotionState);

  assert.ok(mods.aggressiveBoost    <= 15,  'aggressiveBoost max 15');
  assert.ok(mods.aggressiveBoost    >= -5,  'aggressiveBoost min -5');
  assert.ok(mods.complimentModifier <= 5,   'complimentModifier max 5');
  assert.ok(mods.complimentModifier >= -8,  'complimentModifier min -8');
  assert.ok(mods.reflectiveBoost    <= 13,  'reflectiveBoost max 13');
  assert.ok(mods.reflectiveBoost    >= -3,  'reflectiveBoost min -3');
  assert.ok(mods.curiosityBoost     <= 7,   'curiosityBoost max 7');
  assert.ok(mods.curiosityBoost     >= 0,   'curiosityBoost min 0');
});

// ─── describeProfile ─────────────────────────────────────────────────────────

test('describeProfile retorna string com campos do perfil', () => {
  const desc = PersonalityEngine.describeProfile();

  assert.ok(desc.includes('Autoridade'));
  assert.ok(desc.includes('Arrogância'));
  assert.ok(desc.includes('Empatia'));
  assert.ok(desc.includes('Valores'));
  assert.ok(desc.includes('Tabus'));
});

// ─── PERSONALITY_VIOLATIONS completude ───────────────────────────────────────

test('PERSONALITY_VIOLATIONS tem pelo menos 5 regras', () => {
  assert.ok(
    PERSONALITY_VIOLATIONS.length >= 5,
    'deve ter ao menos 5 violations definidas'
  );
});

test('cada violation tem pattern e reason não-vazios', () => {
  for (const v of PERSONALITY_VIOLATIONS) {
    assert.ok(
      v.pattern.length > 0,
      `pattern não pode ser vazio: ${JSON.stringify(v)}`
    );
    assert.ok(
      v.reason.length > 0,
      `reason não pode ser vazio: ${JSON.stringify(v)}`
    );
  }
});

// ─── Integração com ResponseEngine ────────────────────────────────────────────

test('ResponseEngine filtra candidatos que violam personalidade', async () => {
  // Import dinâmico para evitar circular dependency
  const { ResponseEngine } = await import(
    '../src/services/responseEngine'
  );

  const candidates =
    ResponseEngine.generateCandidates('Roma');

  // Todos os candidatos retornados devem ser personality-consistent
  for (const candidate of candidates) {
    assert.ok(
      PersonalityEngine.isConsistent(candidate.text),
      `Candidato viola personalidade: "${candidate.text}"`
    );
  }
});
