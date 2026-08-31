import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ResponseEngine } from '../src/services/responseEngine';

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

  assert.ok(candidates.length > 0);

  const context =
    candidates.find(
      candidate =>
        candidate.source === 'context'
    );

  assert.ok(context);

  const response =
    ResponseEngine.selectResponse(
      'kreprioth matar'
    );

  assert.ok(response);
  assert.equal(
    response,
    context.text
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