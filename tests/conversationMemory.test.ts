import { strict as assert } from 'node:assert';
import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import {
  ConversationMemoryEngine,
} from '../src/intelligence/conversationMemory';
import { MemoryService } from '../src/services/memoryService';
import { MEMORY_LIMITS } from '../src/types/memory';

beforeEach(() => {
  ConversationMemoryEngine.clearShortTerm();
  MemoryService.close();
  MemoryService.initialize(':memory:');
});

afterEach(() => {
  MemoryService.close();
});

// ─── Short-term memory ────────────────────────────────────────────────────────

test('recordInteraction armazena entrada na memória de curto prazo', () => {
  ConversationMemoryEngine.recordInteraction(
    'u1',
    'Roma é eterna',
    'roman'
  );

  const entries =
    ConversationMemoryEngine.getShortTerm('u1');

  assert.equal(entries.length, 1);
  assert.equal(entries[0].content, 'Roma é eterna');
  assert.equal(entries[0].intent,  'roman');
  assert.equal(entries[0].userId,  'u1');
});

test('getShortTerm retorna entradas mais recentes primeiro', () => {
  ConversationMemoryEngine.recordInteraction('u1', 'msg1', 'neutral');
  ConversationMemoryEngine.recordInteraction('u1', 'msg2', 'neutral');
  ConversationMemoryEngine.recordInteraction('u1', 'msg3', 'roman');

  const entries =
    ConversationMemoryEngine.getShortTerm('u1', 3);

  assert.equal(entries[0].content, 'msg3');
  assert.equal(entries[1].content, 'msg2');
  assert.equal(entries[2].content, 'msg1');
});

test('getShortTerm respeita o limite', () => {
  for (let i = 0; i < 10; i++) {
    ConversationMemoryEngine.recordInteraction('u1', `msg${i}`, 'neutral');
  }

  const entries =
    ConversationMemoryEngine.getShortTerm('u1', 3);

  assert.equal(entries.length, 3);
});

test('getShortTerm filtra por userId', () => {
  ConversationMemoryEngine.recordInteraction('u1', 'mensagem de u1', 'neutral');
  ConversationMemoryEngine.recordInteraction('u2', 'mensagem de u2', 'neutral');

  const u1 = ConversationMemoryEngine.getShortTerm('u1');
  const u2 = ConversationMemoryEngine.getShortTerm('u2');

  assert.equal(u1.length, 1);
  assert.equal(u1[0].userId, 'u1');
  assert.equal(u2.length, 1);
  assert.equal(u2[0].userId, 'u2');
});

test('buffer de curto prazo respeita SHORT_TERM_MAX', () => {
  const max = MEMORY_LIMITS.SHORT_TERM_MAX;

  // Adiciona mais entradas do que o limite
  for (let i = 0; i < max + 5; i++) {
    ConversationMemoryEngine.recordInteraction('u1', `msg${i}`, 'neutral');
  }

  const all = ConversationMemoryEngine.getAllShortTerm();

  assert.ok(
    all.length <= max,
    `buffer deve ter no máximo ${max} entradas`
  );
});

test('clearShortTerm limpa o buffer', () => {
  ConversationMemoryEngine.recordInteraction('u1', 'texto', 'neutral');

  ConversationMemoryEngine.clearShortTerm();

  const entries =
    ConversationMemoryEngine.getAllShortTerm();

  assert.equal(entries.length, 0);
});

// ─── Long-term: scoreMemory ────────────────────────────────────────────────────

test('scoreMemory retorna score alto para correspondência de tópico exata', () => {
  const memory = {
    id:        1,
    userId:    'u1',
    topic:     'roma',
    summary:   'Mensagem sobre Roma antiga',
    importance: 5,
    createdAt: Date.now() - 1000,
    lastSeen:  Date.now() - 1000,
  };

  const score = ConversationMemoryEngine.scoreMemory(
    memory,
    'quero falar sobre roma'
  );

  assert.ok(score >= MEMORY_LIMITS.RELEVANCE_THRESHOLD,
    'tópico exato deve produzir score >= threshold');
});

test('scoreMemory retorna 0 para memória expirada de baixa importância', () => {
  const memory = {
    id:        1,
    userId:    'u1',
    topic:     'roma',
    summary:   'Mensagem sobre Roma',
    importance: 1,
    createdAt: 0,
    lastSeen:  0,  // muito antigo
  };

  const score = ConversationMemoryEngine.scoreMemory(
    memory,
    'quero falar sobre roma',
    Date.now()
  );

  assert.equal(score, 0, 'memória expirada de baixa importância deve ter score 0');
});

test('scoreMemory retorna 0 para memória mais velha que MAX_MEMORY_AGE_MS', () => {
  const memory = {
    id:        1,
    userId:    'u1',
    topic:     'ragnar',
    summary:   'Conversa sobre Ragnar',
    importance: 8,
    createdAt: 0,
    lastSeen:  0,  // muito antigo
  };

  const score = ConversationMemoryEngine.scoreMemory(
    memory,
    'ragnar',
    Date.now()
  );

  assert.equal(score, 0, 'memória além de MAX_MEMORY_AGE deve ter score 0');
});

test('scoreMemory favorece memórias mais recentes', () => {
  const base = {
    id:        1,
    userId:    'u1',
    topic:     'roma',
    summary:   'Conversa sobre Roma',
    importance: 3,
    createdAt: Date.now(),
  };

  const recent = {
    ...base,
    lastSeen: Date.now() - 1_000,       // 1 segundo atrás
  };

  const old = {
    ...base,
    lastSeen: Date.now() - 25 * 24 * 60 * 60 * 1000, // 25 dias atrás
  };

  const scoreRecent = ConversationMemoryEngine.scoreMemory(
    recent, 'roma'
  );
  const scoreOld = ConversationMemoryEngine.scoreMemory(
    old, 'roma'
  );

  assert.ok(
    scoreRecent > scoreOld,
    'memória recente deve ter score maior que memória antiga'
  );
});

// ─── Long-term: findRelevant ───────────────────────────────────────────────────

test('findRelevant retorna memórias acima do threshold', () => {
  MemoryService.saveConversation('u1', 'roma', 'Conversa sobre a cidade de Roma', 5);

  const results =
    ConversationMemoryEngine.findRelevant('u1', 'você se lembra de Roma?');

  assert.ok(
    results.length > 0,
    'deve encontrar memória relevante de Roma'
  );

  assert.ok(
    results[0].score >= MEMORY_LIMITS.RELEVANCE_THRESHOLD
  );
});

test('findRelevant retorna array vazio quando não há memória relevante', () => {
  MemoryService.saveConversation('u1', 'ragnar', 'Conversa sobre Ragnar', 3);

  const results =
    ConversationMemoryEngine.findRelevant('u1', 'o tempo está bom hoje');

  assert.equal(
    results.length,
    0,
    'mensagem irrelevante não deve encontrar memórias'
  );
});

test('findRelevant ordena candidatos por score decrescente', () => {
  MemoryService.saveConversation('u1', 'roma',    'Roma imperial e seus imperadores', 8);
  MemoryService.saveConversation('u1', 'ragnar',  'Conversa sobre o guerreiro Ragnar', 3);

  const results =
    ConversationMemoryEngine.findRelevant(
      'u1',
      'quero falar sobre roma e ragnar'
    );

  if (results.length >= 2) {
    assert.ok(
      results[0].score >= results[1].score,
      'candidatos devem estar em ordem decrescente de score'
    );
  }
});

test('findRelevant retorna lista vazia quando usuário não tem memórias', () => {
  const results =
    ConversationMemoryEngine.findRelevant('u_sem_memoria', 'roma');

  assert.equal(results.length, 0);
});

// ─── buildMemoryResponse ──────────────────────────────────────────────────────

test('buildMemoryResponse retorna resposta quando há memória relevante', () => {
  MemoryService.saveConversation(
    'u1',
    'ragnar',
    'Mensagem classificada como roman: Ragnar é um guerreiro nórdico',
    7
  );

  const response =
    ConversationMemoryEngine.buildMemoryResponse('u1', 'Lembras de ragnar?');

  assert.ok(response !== null, 'deve retornar resposta');
  assert.ok(
    response!.includes('ragnar'),
    'resposta deve mencionar o tópico'
  );
});

test('buildMemoryResponse retorna null quando não há memória relevante', () => {
  const response =
    ConversationMemoryEngine.buildMemoryResponse('u1', 'bom dia');

  assert.equal(response, null);
});

// ─── hasRelevantMemory ────────────────────────────────────────────────────────

test('hasRelevantMemory retorna true com memória relevante', () => {
  MemoryService.saveConversation('u1', 'filosofia', 'Conversa profunda sobre filosofia', 6);

  assert.ok(
    ConversationMemoryEngine.hasRelevantMemory('u1', 'filosofia da vida')
  );
});

test('hasRelevantMemory retorna false sem memória relevante', () => {
  assert.equal(
    ConversationMemoryEngine.hasRelevantMemory('u1', 'pizza margherita'),
    false
  );
});

// ─── getDominantRecentIntent ──────────────────────────────────────────────────

test('getDominantRecentIntent identifica intent mais frequente', () => {
  ConversationMemoryEngine.recordInteraction('u1', 'msg1', 'roman');
  ConversationMemoryEngine.recordInteraction('u1', 'msg2', 'roman');
  ConversationMemoryEngine.recordInteraction('u1', 'msg3', 'neutral');

  const intent =
    ConversationMemoryEngine.getDominantRecentIntent('u1', 5);

  assert.equal(intent, 'roman');
});

test('getDominantRecentIntent retorna null sem histórico', () => {
  const intent =
    ConversationMemoryEngine.getDominantRecentIntent('u_novo', 5);

  assert.equal(intent, null);
});

// ─── getIntentStreak ──────────────────────────────────────────────────────────

test('getIntentStreak conta sequência consecutiva de mesmo intent', () => {
  ConversationMemoryEngine.recordInteraction('u1', 'msg1', 'roman');
  ConversationMemoryEngine.recordInteraction('u1', 'msg2', 'roman');
  ConversationMemoryEngine.recordInteraction('u1', 'msg3', 'roman');

  const streak =
    ConversationMemoryEngine.getIntentStreak('u1', 'roman');

  assert.equal(streak, 3);
});

test('getIntentStreak retorna 0 quando streak é quebrada', () => {
  ConversationMemoryEngine.recordInteraction('u1', 'msg1', 'roman');
  ConversationMemoryEngine.recordInteraction('u1', 'msg2', 'neutral');  // quebra
  ConversationMemoryEngine.recordInteraction('u1', 'msg3', 'roman');

  // Mais recente primeiro: roman, neutral, roman -- streak de roman = 1
  const streak =
    ConversationMemoryEngine.getIntentStreak('u1', 'roman');

  assert.equal(streak, 1);
});

// ─── resolve ─────────────────────────────────────────────────────────────────

test('resolve retorna contexto completo', () => {
  ConversationMemoryEngine.recordInteraction('u1', 'fala sobre Roma', 'roman');
  MemoryService.saveConversation('u1', 'roma', 'Roma antiga e imperial', 7);

  const ctx = ConversationMemoryEngine.resolve('u1', 'Roma');

  assert.ok(ctx.shortTerm.length > 0, 'deve ter short-term entries');
  assert.ok(ctx.longTerm !== null,     'deve ter long-term relevante');
  assert.ok(
    ctx.candidates.length > 0,
    'deve ter candidatos'
  );
});
