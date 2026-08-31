import { strict as assert } from 'node:assert';
import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import { MemoryService } from '../src/services/memoryService';
import { ResponseEngine } from '../src/services/responseEngine';

beforeEach(() => {
  MemoryService.close();
  MemoryService.initialize(':memory:');
});

afterEach(() => {
  MemoryService.close();
});

test('gera resposta para combinação de contexto', () => {
  const candidates =
    ResponseEngine.generateCandidates(
      'ragnar morrer'
    );

  assert.ok(candidates.length > 0);

  assert.ok(
    candidates.some(
      candidate =>
        candidate.source === 'context'
    )
  );
});

test('prioriza contexto sobre keyword', () => {
  const candidates =
    ResponseEngine.generateCandidates(
      'kreprioth matar'
    );

  const contextCandidates =
    candidates.filter(
      candidate =>
        candidate.source === 'context'
    );

  assert.ok(
    contextCandidates.length > 0
  );

  const keywordCandidates =
    candidates.filter(
      candidate =>
        candidate.source === 'keyword' ||
        candidate.source === 'aggressive'
    );

  assert.ok(
    keywordCandidates.length > 0
  );

  const highestContextScore =
    Math.max(
      ...contextCandidates.map(
        candidate => candidate.score
      )
    );

  const highestOtherScore =
    Math.max(
      ...keywordCandidates.map(
        candidate => candidate.score
      )
    );

  assert.ok(
    highestContextScore >
      highestOtherScore
  );

  const response =
    ResponseEngine.selectResponse(
      'kreprioth matar'
    );

  assert.ok(response);

  assert.ok(
    contextCandidates.some(
      candidate =>
        candidate.text === response
    )
  );
});

test('gera resposta para elogio', () => {
  const candidates =
    ResponseEngine.generateCandidates(
      'Tibério é incrível'
    );

  assert.ok(
    candidates.some(
      candidate =>
        candidate.source === 'compliment'
    )
  );
});

test('gera resposta para keyword', () => {
  const candidates =
    ResponseEngine.generateCandidates(
      'Roma'
    );

  assert.ok(
    candidates.some(
      candidate =>
        candidate.source === 'keyword' ||
        candidate.source === 'intent'
    )
  );
});