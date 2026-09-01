import { strict as assert } from 'node:assert';

import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import {
  MemoryService,
} from '../src/services/memoryService';

import {
  AutoMemoryService,
} from '../src/services/autoMemoryService';

beforeEach(() => {
  MemoryService.close();

  MemoryService.initialize(
    ':memory:'
  );

  MemoryService.clear();
});

afterEach(() => {
  MemoryService.close();
});

test(
  'extrai tópico presente nas keywords',
  () => {
    const candidate =
      AutoMemoryService.extractCandidate(
        'Quero falar sobre Roma'
      );

    assert.ok(candidate);

    assert.equal(
      candidate?.topic,
      'roma'
    );
  }
);

test(
  'extrai tópico definido apenas em contexto',
  () => {
    const candidate =
      AutoMemoryService.extractCandidate(
        'Estou pensando em kreprioth matar'
      );

    assert.ok(candidate);

    assert.equal(
      candidate?.topic,
      'kreprioth'
    );
  }
);

test(
  'extrai automaticamente personagem do JSON',
  () => {
    const candidate =
      AutoMemoryService.extractCandidate(
        'O que aconteceu com Jamal?'
      );

    assert.ok(candidate);

    assert.equal(
      candidate?.topic,
      'jamal'
    );
  }
);

test(
  'extrai tópico filosófico',
  () => {
    const candidate =
      AutoMemoryService.extractCandidate(
        'Qual é o sentido da vida?'
      );

    assert.ok(candidate);

    assert.equal(
      candidate?.topic,
      'vida'
    );
  }
);

test(
  'aumenta importância para assuntos sérios',
  () => {
    const candidate =
      AutoMemoryService.extractCandidate(
        'A guerra e o sofrimento são inevitáveis.'
      );

    assert.ok(candidate);

    assert.ok(
      (candidate?.importance ?? 0) >= 3
    );
  }
);

test(
  'salva memória automaticamente',
  () => {
    AutoMemoryService.processMessage(
      '123',
      'Kilop',
      'Quero falar sobre Roma'
    );

    const memories =
      MemoryService.getUserConversations(
        '123'
      );

    assert.equal(
      memories.length,
      1
    );

    assert.equal(
      memories[0].topic,
      'roma'
    );
  }
);

test(
  'atualiza memória do mesmo tópico',
  () => {
    AutoMemoryService.processMessage(
      '123',
      'Kilop',
      'Roma é importante'
    );

    AutoMemoryService.processMessage(
      '123',
      'Kilop',
      'Roma possui uma história enorme'
    );

    const memories =
      MemoryService.getUserConversations(
        '123'
      );

    assert.equal(
      memories.length,
      1
    );
  }
);