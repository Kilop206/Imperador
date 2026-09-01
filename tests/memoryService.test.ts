import { strict as assert } from 'node:assert';

import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import {
  MemoryService,
} from '../src/services/memoryService';

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
  'cria memória de uma palavra',
  () => {
    const count =
      MemoryService.incrementWord(
        'tártaro'
      );

    assert.equal(
      count,
      1
    );

    assert.equal(
      MemoryService.getWordCount(
        'tártaro'
      ),
      1
    );
  }
);

test(
  'incrementa frequência persistente',
  () => {
    MemoryService.incrementWord(
      'tártaro'
    );

    MemoryService.incrementWord(
      'tártaro'
    );

    MemoryService.incrementWord(
      'tártaro'
    );

    assert.equal(
      MemoryService.getWordCount(
        'tártaro'
      ),
      3
    );
  }
);

test(
  'normaliza palavras na memória',
  () => {
    MemoryService.incrementWord(
      'TÁRTARO'
    );

    assert.equal(
      MemoryService.getWordCount(
        'tártaro'
      ),
      1
    );
  }
);

test(
  'retorna memória detalhada',
  () => {
    MemoryService.incrementWord(
      'roma'
    );

    const memory =
      MemoryService.getWordMemory(
        'roma'
      );

    assert.ok(memory);
    assert.equal(
      memory?.word,
      'roma'
    );
    assert.equal(
      memory?.count,
      1
    );
    assert.ok(
      memory?.lastSeen
    );
  }
);

test(
  'retorna palavras mais mencionadas',
  () => {
    MemoryService.incrementWord(
      'roma'
    );

    MemoryService.incrementWord(
      'roma'
    );

    MemoryService.incrementWord(
      'roma'
    );

    MemoryService.incrementWord(
      'império'
    );

    const words =
      MemoryService.getMostMentionedWords(
        2
      );

    assert.equal(
      words.length,
      2
    );

    assert.equal(
      words[0].word,
      'roma'
    );
  }
);

test(
  'registra usuário',
  () => {
    const user =
      MemoryService.upsertUser(
        '123',
        'Kilop'
      );

    assert.equal(
      user.userId,
      '123'
    );

    assert.equal(
      user.username,
      'Kilop'
    );

    assert.equal(
      user.messageCount,
      1
    );
  }
);

test(
  'incrementa mensagens do usuário',
  () => {
    MemoryService.upsertUser(
      '123',
      'Kilop'
    );

    const user =
      MemoryService.upsertUser(
        '123',
        'Kilop'
      );

    assert.equal(
      user.messageCount,
      2
    );
  }
);

test(
  'salva memória de conversa',
  () => {
    const memory =
      MemoryService.saveConversation(
        '123',
        'roma',
        'Usuário demonstrou interesse por Roma.',
        5
      );

    assert.equal(
      memory.userId,
      '123'
    );

    assert.equal(
      memory.topic,
      'roma'
    );

    assert.equal(
      memory.importance,
      5
    );
  }
);

test(
  'atualiza memória existente do mesmo tópico',
  () => {
    const first =
      MemoryService.saveConversation(
        '123',
        'roma',
        'Primeiro resumo.',
        2
      );

    const second =
      MemoryService.saveConversation(
        '123',
        'roma',
        'Segundo resumo.',
        7
      );

    assert.equal(
      first.id,
      second.id
    );

    assert.equal(
      second.summary,
      'Segundo resumo.'
    );

    assert.equal(
      second.importance,
      7
    );
  }
);

test(
  'recupera memórias do usuário',
  () => {
    MemoryService.saveConversation(
      '123',
      'roma',
      'Interesse em Roma.',
      5
    );

    MemoryService.saveConversation(
      '123',
      'tártaro',
      'Falou sobre Tártaro.',
      8
    );

    const conversations =
      MemoryService.getUserConversations(
        '123'
      );

    assert.equal(
      conversations.length,
      2
    );

    assert.equal(
      conversations[0].topic,
      'tártaro'
    );
  }
);

test(
  'salva evento',
  () => {
    const event =
      MemoryService.saveEvent(
        '123',
        'question',
        'Qual é o destino de Roma?',
        5
      );

    assert.equal(
      event.userId,
      '123'
    );

    assert.equal(
      event.type,
      'question'
    );

    assert.equal(
      event.importance,
      5
    );
  }
);

test(
  'recupera eventos do usuário',
  () => {
    MemoryService.saveEvent(
      '123',
      'question',
      'Pergunta sobre Roma.',
      5
    );

    MemoryService.saveEvent(
      '123',
      'compliment',
      'Elogiou Tibério.',
      3
    );

    const events =
      MemoryService.getUserEvents(
        '123'
      );

    assert.equal(
      events.length,
      2
    );
  }
);

test(
  'recupera apenas eventos importantes',
  () => {
    MemoryService.saveEvent(
      '123',
      'message',
      'Mensagem comum.',
      2
    );

    MemoryService.saveEvent(
      '123',
      'question',
      'Pergunta importante.',
      8
    );

    const events =
      MemoryService.getImportantUserEvents(
        '123',
        5
      );

    assert.equal(
      events.length,
      1
    );

    assert.equal(
      events[0].importance,
      8
    );
  }
);