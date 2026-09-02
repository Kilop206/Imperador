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
  ResponseEngine,
} from '../src/services/responseEngine';

import {
  SemanticContextService,
} from '../src/intelligence/semanticContextService';

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
  'gera resposta para combinação de contexto',
  () => {
    const candidates =
      ResponseEngine.generateCandidates(
        'ragnar morrer'
      );

    assert.ok(
      candidates.length > 0
    );

    assert.ok(
      candidates.some(
        candidate =>
          candidate.source ===
          'context'
      )
    );
  }
);

test(
  'prioriza contexto sobre outras respostas',
  () => {
    const content =
      'bob mirella';

    const candidates =
      ResponseEngine.generateCandidates(
        content
      );

    const contextCandidates =
      candidates.filter(
        candidate =>
          candidate.source ===
          'context'
      );

    assert.ok(
      contextCandidates.length > 0
    );

    const highestContextScore =
      Math.max(
        ...contextCandidates.map(
          candidate =>
            candidate.score
        )
      );

    const highestScore =
      Math.max(
        ...candidates.map(
          candidate =>
            candidate.score
        )
      );

    assert.equal(
      highestContextScore,
      highestScore
    );

    const response =
      ResponseEngine.selectResponse(
        content
      );

    assert.ok(response);

    assert.ok(
      contextCandidates.some(
        candidate =>
          candidate.text ===
          response
      )
    );
  }
);

test(
  'gera resposta para elogio',
  () => {
    const candidates =
      ResponseEngine.generateCandidates(
        'Tibério é incrível'
      );

    assert.ok(
      candidates.some(
        candidate =>
          candidate.source ===
          'compliment'
      )
    );
  }
);

test(
  'gera resposta para keyword',
  () => {
    const candidates =
      ResponseEngine.generateCandidates(
        'Roma'
      );

    assert.ok(
      candidates.some(
        candidate =>
          candidate.source ===
            'keyword' ||
          candidate.source ===
            'intent'
      )
    );
  }
);

test(
  'utiliza memória do usuário',
  () => {
    MemoryService.upsertUser(
      '123',
      'Kilop'
    );

    MemoryService.saveConversation(
      '123',
      'roma',
      'Usuário demonstrou interesse por Roma.',
      8
    );

    const candidates =
      ResponseEngine.generateCandidates(
        'Você lembra de Roma?',
        '123'
      );

    assert.ok(
      candidates.some(
        candidate =>
          candidate.source ===
          'memory'
      )
    );
  }
);

test(
  'memória pode vencer uma keyword comum',
  () => {
    MemoryService.upsertUser(
      '123',
      'Kilop'
    );

    MemoryService.saveConversation(
      '123',
      'roma',
      'Usuário demonstrou interesse por Roma.',
      8
    );

    const candidates =
      ResponseEngine.generateCandidates(
        'Você lembra de Roma?',
        '123'
      );

    const memory =
      candidates.find(
        candidate =>
          candidate.source ===
          'memory'
      );

    assert.ok(memory);

    const keywordCandidates =
      candidates.filter(
        candidate =>
          candidate.source ===
          'keyword'
      );

    if (
      keywordCandidates.length > 0
    ) {
      const highestKeyword =
        Math.max(
          ...keywordCandidates.map(
            candidate =>
              candidate.score
          )
        );

      assert.ok(
        memory.score >
          highestKeyword
      );
    }
  }
);

test(
  'setSemanticService deve usar diretamente a instância fornecida',
  () => {
    const semanticService =
      new SemanticContextService();

    semanticService.enable();

    ResponseEngine.setSemanticService(
      semanticService
    );

    MemoryService.upsertUser(
      '456',
      'Kilop'
    );

    MemoryService.saveConversation(
      '456',
      'roma',
      'Usuário demonstrou interesse por Roma.',
      5
    );

    const candidates =
      ResponseEngine.generateCandidates(
        'Você lembra de Roma?',
        '456'
      );

    assert.ok(
      candidates.some(
        candidate =>
          candidate.source ===
          'semantic'
      )
    );
  }
);