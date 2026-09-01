import { strict as assert } from 'node:assert';
import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import { MemoryService } from '../src/services/memoryService';
import {
  MemoryContextService,
} from '../src/services/memoryContext';

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
  'constrói contexto de memória',
  () => {
    MemoryService.upsertUser(
      '123',
      'Kilop'
    );

    MemoryService.saveConversation(
      '123',
      'roma',
      'Usuário falou sobre Roma.',
      8
    );

    const context =
      MemoryContextService.build(
        '123'
      );

    assert.ok(
      context.user
    );

    assert.equal(
      context.user?.username,
      'Kilop'
    );

    assert.equal(
      context.recentConversations.length,
      1
    );
  }
);

test(
  'formata contexto de memória',
  () => {
    MemoryService.upsertUser(
      '123',
      'Kilop'
    );

    MemoryService.saveConversation(
      '123',
      'roma',
      'Usuário falou sobre Roma.',
      8
    );

    const context =
      MemoryContextService.build(
        '123'
      );

    const formatted =
      MemoryContextService.format(
        context
      );

    assert.ok(
      formatted.includes(
        'Kilop'
      )
    );

    assert.ok(
      formatted.includes(
        'roma'
      )
    );
  }
);